import type { LiveHomeworkRepoPort } from "../ports/liveHomeworkRepoPort";
import type { SetRepoPort } from "../ports/setRepoPort";
import type { CardRepoPort } from "../ports/cardRepoPort";
import type { UserRepoPort } from "../ports/userRepoPort";
import type { HomeworkAssignment, HomeworkAttempt, HomeworkLeaderboardEntry } from "../domain/liveHomework";
import type { LiveQuestion, PublicLiveQuestion } from "../domain/liveQuiz";
import {
  daysUntilDeadline,
  homeworkDeadlineInstant,
  homeworkLeaderboard,
  homeworkQuestions,
  isDeadlinePassed,
  scoreHomeworkAnswer,
  toPublicHomeworkQuestion,
  toUtcDateString,
} from "../domain/liveHomework";
import { generateRoomCode, isValidRoomCode } from "../domain/liveQuiz";
import { getOwnedSet } from "./setUsecases";
import { ForbiddenError, NotFoundError, ValidationError } from "../domain/errors";

/**
 * Orchestration for slice 17's async homework mode. ZERO transport/socket/
 * WebSocket code here (or anywhere in this feature) — see
 * docs/ADR-homework-mode.md for why homework is plain SSR + htmx form POSTs
 * against a real DB table, not the in-memory live-quiz sidecar. Everything is
 * testable against a real sqlite-backed repo with no network (see
 * tests/liveHomeworkUsecases.test.ts), and the pure scoring/eligibility logic
 * is the exact core/domain/liveQuiz.ts code live mode uses.
 *
 * Ownership discipline (the single most common review finding across this
 * project — see docs/architecture.md): creating an assignment and viewing the
 * host status page are BOTH owner-gated via the same getOwnedSet every other
 * owner-only action uses; submitting an attempt is scoped to the authenticated
 * student's OWN attempt row only, never reading/touching another student's.
 */

// --- Create (owner-only) --------------------------------------------------

export interface CreateHomeworkAssignmentInput {
  setId: string;
  hostId: string;
  /**
   * The `new Date("YYYY-MM-DD")` value from the date input (UTC midnight per
   * ECMA-262). Validated against `now` by UTC calendar-date string — slice 8's
   * exact timezone fix — then widened to an end-of-UTC-day deadline instant.
   */
  deadlineDate: Date;
  now?: Date;
}

export interface HomeworkRepos {
  homeworkRepo: LiveHomeworkRepoPort;
  setRepo: SetRepoPort;
  cardRepo: CardRepoPort;
}

/** How many code-generation attempts before giving up (astronomically unlikely to be hit — same style as setRepo's uniqueSlug). */
const CODE_GEN_ATTEMPTS = 10;

/**
 * Owner-only: publishes one of the host's own sets as a homework assignment
 * with a future deadline. Reuses getOwnedSet so a non-owner (even logged-in)
 * request 403s before anything is written. The set must have at least one
 * live-eligible card (multiple_choice/true_false/type_answer), same scope cut
 * as live mode's createLiveSession.
 *
 * Deadline rule (slice 8 reuse): "today or later" accepted, compared by UTC
 * calendar-date string so the server's own timezone can never reject a
 * same-day deadline — see setUsecases.setExamDate for the class of bug this
 * avoids, and tests/liveHomework.test.ts for the real-clock-time proof.
 */
export async function createHomeworkAssignment(deps: HomeworkRepos, input: CreateHomeworkAssignmentInput): Promise<HomeworkAssignment> {
  const now = input.now ?? new Date();
  await getOwnedSet(deps.setRepo, input.setId, input.hostId); // throws NotFoundError/ForbiddenError

  if (Number.isNaN(input.deadlineDate.getTime())) throw new ValidationError("Invalid deadline");
  if (toUtcDateString(input.deadlineDate) < toUtcDateString(now)) {
    throw new ValidationError("Deadline must be today or in the future");
  }

  const cards = await deps.cardRepo.listAllBySet(input.setId);
  if (homeworkQuestions(cards).length === 0) {
    throw new ValidationError("This set has no multiple-choice/true-false/type-answer cards to assign as homework");
  }

  const deadline = homeworkDeadlineInstant(input.deadlineDate);

  let code = "";
  for (let attempt = 0; attempt < CODE_GEN_ATTEMPTS; attempt++) {
    const candidate = generateRoomCode();
    const clash = await deps.homeworkRepo.findAssignmentByCode(candidate);
    if (!clash) {
      code = candidate;
      break;
    }
  }
  if (code === "") throw new Error("Could not generate a unique homework code");

  return deps.homeworkRepo.createAssignment({ setId: input.setId, hostId: input.hostId, code, deadline });
}

/** Every homework assignment created from a set, owner-gated (for the set detail page's list). */
export async function listHomeworkAssignmentsForSet(deps: HomeworkRepos, setId: string, ownerId: string): Promise<HomeworkAssignment[]> {
  await getOwnedSet(deps.setRepo, setId, ownerId);
  return deps.homeworkRepo.listAssignmentsBySet(setId);
}

// --- Lookup ---------------------------------------------------------------

/** Resolves an assignment by its shared code. Normalizes/validates the code shape, 404s on unknown — the student-side "join by code" entry point. */
export async function getHomeworkAssignmentByCode(homeworkRepo: LiveHomeworkRepoPort, rawCode: string): Promise<HomeworkAssignment> {
  const code = rawCode.trim().toUpperCase();
  if (!isValidRoomCode(code)) throw new NotFoundError("Assignment");
  const assignment = await homeworkRepo.findAssignmentByCode(code);
  if (!assignment) throw new NotFoundError("Assignment");
  return assignment;
}

// --- Play (student) -------------------------------------------------------

export interface HomeworkPlayState {
  assignment: HomeworkAssignment;
  attempt: HomeworkAttempt;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  /** The next unanswered question (answer-stripped), or null when the attempt is finished. */
  currentQuestion: PublicLiveQuestion | null;
  /** True once every question is answered (completed) OR the deadline has passed — no more answers accepted either way. */
  finished: boolean;
  deadlinePassed: boolean;
}

async function loadOrderedQuestions(deps: HomeworkRepos, assignment: HomeworkAssignment): Promise<LiveQuestion[]> {
  const cards = await deps.cardRepo.listAllBySet(assignment.setId);
  return homeworkQuestions(cards);
}

/**
 * Finds this student's attempt, creating it on first play. Race-safe: a
 * concurrent first play from two tabs both miss the initial findAttempt, both
 * try createAttempt, the DB unique index on (assignmentId, userId) lets only
 * one insert win, and the loser re-reads the winner's row instead of crashing
 * or duplicating — the exact read-then-create pattern (and fix) slice 15's
 * findOrCreatePracticeSet uses. Refuses to START a new attempt once the
 * deadline has passed, but never blocks re-reading an EXISTING one (a student
 * can always view their finished result).
 */
async function ensureAttempt(deps: HomeworkRepos, assignment: HomeworkAssignment, userId: string, now: Date): Promise<HomeworkAttempt> {
  const existing = await deps.homeworkRepo.findAttempt(assignment.id, userId);
  if (existing) return existing;
  if (isDeadlinePassed(assignment.deadline, now)) {
    throw new ValidationError("This assignment's deadline has passed");
  }
  try {
    return await deps.homeworkRepo.createAttempt({ assignmentId: assignment.id, userId });
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;
    const winner = await deps.homeworkRepo.findAttempt(assignment.id, userId);
    if (!winner) throw err; // shouldn't happen: the constraint fired because a row exists
    return winner;
  }
}

/**
 * True if `err` is a UNIQUE-constraint violation from either driver, at any
 * wrapping depth — same helper shape (and same reason for checking
 * err.cause.message one level down) as liveQuizPostGameUsecases.ts's copy.
 * Duplicated locally rather than shared so each feature's concurrency guard is
 * self-contained and independently reviewable.
 */
function isUniqueConstraintError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const pattern = /unique constraint|duplicate key/i;
  if (pattern.test(err.message)) return true;
  const cause = (err as { cause?: unknown }).cause;
  return cause instanceof Error && pattern.test(cause.message);
}

function buildPlayState(
  assignment: HomeworkAssignment,
  attempt: HomeworkAttempt,
  questions: LiveQuestion[],
  answeredCardIds: Set<string>,
  correctCount: number,
  now: Date,
): HomeworkPlayState {
  const deadlinePassed = isDeadlinePassed(assignment.deadline, now);
  const next = questions.find((q) => !answeredCardIds.has(q.cardId)) ?? null;
  const allAnswered = answeredCardIds.size >= questions.length;
  return {
    assignment,
    attempt,
    totalQuestions: questions.length,
    answeredCount: answeredCardIds.size,
    correctCount,
    currentQuestion: allAnswered || deadlinePassed ? null : next ? toPublicHomeworkQuestion(next) : null,
    finished: allAnswered || deadlinePassed,
    deadlinePassed,
  };
}

/**
 * The student's live view of their own attempt: which question is next, how
 * far along, whether it's finished. Read-only — creates the attempt on first
 * call (see ensureAttempt) but records no answer. Never reads any other
 * student's attempt.
 */
export async function getHomeworkPlayState(deps: HomeworkRepos, input: { code: string; userId: string; now?: Date }): Promise<HomeworkPlayState> {
  const now = input.now ?? new Date();
  const assignment = await getHomeworkAssignmentByCode(deps.homeworkRepo, input.code);
  const attempt = await ensureAttempt(deps, assignment, input.userId, now);
  const questions = await loadOrderedQuestions(deps, assignment);
  const answers = await deps.homeworkRepo.listAnswers(attempt.id);
  const answeredCardIds = new Set(answers.map((a) => a.cardId));
  const correctCount = answers.filter((a) => a.correct).length;
  return buildPlayState(assignment, attempt, questions, answeredCardIds, correctCount, now);
}

export interface SubmitHomeworkAnswerInput {
  code: string;
  userId: string;
  cardId: string;
  rawAnswer: string;
  now?: Date;
}

/**
 * Records one answer to one question of the authenticated student's OWN
 * attempt, then returns the refreshed play state. Enforced server-side, in
 * order:
 *   - the deadline: a submission after it is rejected (ValidationError), never
 *     just hidden client-side;
 *   - one attempt only: a submission against an already-COMPLETED attempt is
 *     rejected — a finished student can view their result but not resubmit;
 *   - correctness: scored once, now, via the reused pure isAnswerCorrect (base
 *     correctness only, NO speed bonus — see the ADR).
 *
 * Idempotency/concurrency (applied from the start per slices 15/16): the answer
 * is inserted under a DB-level unique index on (attemptId, cardId) with
 * onConflictDoNothing, so a double form-submit / network retry / two concurrent
 * tabs answering the same question produce exactly one recorded answer and one
 * score, never two. Completion (setting completedAt + the snapshot score) is a
 * one-way, WHERE-completedAt-IS-NULL transition, so two tabs finishing the last
 * question at once resolve to a single completion. See the genuine Promise.all
 * concurrency test in tests/liveHomeworkUsecases.test.ts.
 */
export async function submitHomeworkAnswer(deps: HomeworkRepos, input: SubmitHomeworkAnswerInput): Promise<HomeworkPlayState> {
  const now = input.now ?? new Date();
  const assignment = await getHomeworkAssignmentByCode(deps.homeworkRepo, input.code);

  if (isDeadlinePassed(assignment.deadline, now)) {
    throw new ValidationError("This assignment's deadline has passed");
  }

  const attempt = await ensureAttempt(deps, assignment, input.userId, now);
  if (attempt.completedAt !== null) {
    throw new ValidationError("You have already completed this assignment");
  }

  const questions = await loadOrderedQuestions(deps, assignment);
  const question = questions.find((q) => q.cardId === input.cardId);
  if (!question) throw new ValidationError("Answer does not match a question in this assignment");

  const { correct } = scoreHomeworkAnswer(question, input.rawAnswer);
  await deps.homeworkRepo.recordAnswer({ attemptId: attempt.id, cardId: input.cardId, correct, answeredAt: now });

  // Recompute from the source-of-truth answer records (deduped by the unique
  // index) so a concurrent double-submit can't inflate the count.
  const answers = await deps.homeworkRepo.listAnswers(attempt.id);
  const answeredCardIds = new Set(answers.map((a) => a.cardId));
  const correctCount = answers.filter((a) => a.correct).length;

  if (answeredCardIds.size >= questions.length && questions.length > 0) {
    await deps.homeworkRepo.completeAttempt(attempt.id, correctCount, now); // idempotent: only sets while completedAt is null
  }

  const refreshed = (await deps.homeworkRepo.findAttempt(assignment.id, input.userId)) ?? attempt;
  return buildPlayState(assignment, refreshed, questions, answeredCardIds, correctCount, now);
}

// --- Leaderboard + host status --------------------------------------------

/**
 * The individual leaderboard for an assignment, scored from the source-of-truth
 * answer records (so an in-progress attempt still ranks by what it has
 * answered — the "in-progress-when-the-deadline-passes is scored as-is"
 * decision, documented in the ADR). Reused by BOTH the student-facing result
 * view and the host status view — the sort/tiebreak lives once, in
 * homeworkLeaderboard.
 */
async function buildLeaderboard(deps: { homeworkRepo: LiveHomeworkRepoPort; userRepo: UserRepoPort }, assignment: HomeworkAssignment): Promise<HomeworkLeaderboardEntry[]> {
  const attempts = await deps.homeworkRepo.listAttemptsByAssignment(assignment.id);
  const answers = await deps.homeworkRepo.listAnswersByAssignment(assignment.id);
  const correctByAttempt = new Map<string, number>();
  for (const a of answers) {
    if (a.correct) correctByAttempt.set(a.attemptId, (correctByAttempt.get(a.attemptId) ?? 0) + 1);
  }

  const rows = await Promise.all(
    attempts.map(async (attempt) => {
      const user = await deps.userRepo.findById(attempt.userId);
      return {
        userId: attempt.userId,
        displayName: user?.displayName ?? attempt.userId,
        score: correctByAttempt.get(attempt.id) ?? 0,
        completedAt: attempt.completedAt,
      };
    }),
  );
  return homeworkLeaderboard(rows);
}

export interface HomeworkStatusView {
  assignment: HomeworkAssignment;
  totalQuestions: number;
  attemptCount: number;
  completedCount: number;
  daysRemaining: number;
  deadlinePassed: boolean;
  leaderboard: HomeworkLeaderboardEntry[];
}

/**
 * Owner-only host status page data: completion count, time remaining, and the
 * leaderboard. Owner-gated by the SAME getOwnedSet as everything else — a
 * non-owner (even logged-in) request 403s. No WebSocket/live moment here: a
 * normal page reload shows current data (see the ADR — there is nothing
 * real-time to watch).
 */
export async function getHomeworkStatus(
  deps: HomeworkRepos & { userRepo: UserRepoPort },
  code: string,
  requesterId: string,
  now: Date = new Date(),
): Promise<HomeworkStatusView> {
  const assignment = await getHomeworkAssignmentByCode(deps.homeworkRepo, code);
  // Re-derive ownership from the assignment's own hostId AND the source set —
  // getOwnedSet throws ForbiddenError for anyone who isn't the set owner.
  await getOwnedSet(deps.setRepo, assignment.setId, requesterId);
  if (assignment.hostId !== requesterId) throw new ForbiddenError("You do not own this assignment");

  const questions = await loadOrderedQuestions(deps, assignment);
  const attempts = await deps.homeworkRepo.listAttemptsByAssignment(assignment.id);
  const leaderboard = await buildLeaderboard(deps, assignment);

  return {
    assignment,
    totalQuestions: questions.length,
    attemptCount: attempts.length,
    completedCount: attempts.filter((a) => a.completedAt !== null).length,
    daysRemaining: daysUntilDeadline(assignment.deadline, now),
    deadlinePassed: isDeadlinePassed(assignment.deadline, now),
    leaderboard,
  };
}

export interface HomeworkResultView {
  assignment: HomeworkAssignment;
  attempt: HomeworkAttempt;
  totalQuestions: number;
  correctCount: number;
  deadlinePassed: boolean;
  leaderboard: HomeworkLeaderboardEntry[];
}

/**
 * The student-facing result view for their own finished (or deadline-closed)
 * attempt: their score plus the individual leaderboard. Only ever reads the
 * requesting student's own attempt row for the "your result" part; the
 * leaderboard is the same aggregate everyone sees. 404s if the student never
 * started an attempt.
 */
export async function getHomeworkResult(
  deps: HomeworkRepos & { userRepo: UserRepoPort },
  code: string,
  userId: string,
  now: Date = new Date(),
): Promise<HomeworkResultView> {
  const assignment = await getHomeworkAssignmentByCode(deps.homeworkRepo, code);
  const attempt = await deps.homeworkRepo.findAttempt(assignment.id, userId);
  if (!attempt) throw new NotFoundError("Attempt");

  const questions = await loadOrderedQuestions(deps, assignment);
  const answers = await deps.homeworkRepo.listAnswers(attempt.id);
  const leaderboard = await buildLeaderboard(deps, assignment);

  return {
    assignment,
    attempt,
    totalQuestions: questions.length,
    correctCount: answers.filter((a) => a.correct).length,
    deadlinePassed: isDeadlinePassed(assignment.deadline, now),
    leaderboard,
  };
}
