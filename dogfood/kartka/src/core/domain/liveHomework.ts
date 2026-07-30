// Live homework mode (slice 17): pure domain types + logic for an ASYNC,
// deadline-bound variant of the live-quiz room concept. Zero imports from
// adapters/*, astro:*, or any framework/transport code — see
// docs/architecture.md's hexagonal boundary rule and docs/ADR-homework-mode.md
// for why this feature is deliberately NOT built on the in-memory
// RoomState/LiveSessionPort/WebSocket machinery slices 11-13 use.
//
// What IS reused from core/domain/liveQuiz.ts: the pure question-eligibility
// and per-type correctness logic (isLiveEligibleType, isAnswerCorrect,
// toPublicQuestion) and the room-code generator (generateRoomCode). What is
// deliberately NOT reused: scoreAnswer's speed-bonus math (see
// docs/ADR-homework-mode.md — a speed bonus is only fair when every player
// faces the same synchronized timer; homework players answer at arbitrarily
// different real times, so homework scoring is base-correctness only).

import type { LiveCardType, LiveQuestion, PublicLiveQuestion } from "./liveQuiz";
import { isAnswerCorrect, isLiveEligibleType, toPublicQuestion } from "./liveQuiz";
import type { Card } from "./types";

// --- Durable record shapes (see core/ports/liveHomeworkRepoPort.ts) -------

/**
 * One homework assignment: a host's set, published under a short shareable
 * `code` (same generator/shape as a live-quiz room code — see
 * generateRoomCode), playable by any logged-in student until `deadline`.
 * Unlike a live-quiz RoomState this is a durable DB row, not in-memory: it
 * must survive sidecar/app restarts across the days until the deadline.
 */
export interface HomeworkAssignment {
  id: string;
  setId: string;
  hostId: string;
  code: string;
  /** The exact instant after which no new attempts/answers are accepted (server-side enforced). See homeworkDeadlineInstant. */
  deadline: Date;
  createdAt: Date;
}

/**
 * One student's single attempt at one assignment. `completedAt` is null while
 * in progress and set once the student answers every question (or, your-call
 * scope decision documented in the ADR, is left null if the deadline passes
 * mid-attempt — the leaderboard scores an in-progress attempt from its
 * recorded answers regardless, see homeworkLeaderboard's callers). At most one
 * row per (assignmentId, userId) — enforced by a DB-level unique index.
 */
export interface HomeworkAttempt {
  id: string;
  assignmentId: string;
  userId: string;
  /** Snapshot correct-count set at completion. The leaderboard/status views recompute from answer records (source of truth) so an in-progress attempt still ranks by what it has answered — see the port doc. */
  score: number;
  completedAt: Date | null;
  createdAt: Date;
}

/**
 * One recorded answer to one question within one attempt. At most one row per
 * (attemptId, cardId) — a DB-level unique index is the real double-submit /
 * double-tab guard (a second submission of the same question is a silent
 * no-op, never a re-score), the same DB-constraint discipline slices 15/16
 * landed on. `correct` is computed once, at record time, via the reused pure
 * isAnswerCorrect — never recomputed later.
 */
export interface HomeworkAnswer {
  id: string;
  attemptId: string;
  cardId: string;
  correct: boolean;
  answeredAt: Date;
}

// --- Deadline handling ----------------------------------------------------
// Reuses slice 8's exact UTC-calendar-date fix (see setUsecases.setExamDate):
// a date-only deadline from an <input type=date> "YYYY-MM-DD" value parses as
// UTC midnight (ECMA-262). Comparing that against a server-*local* midnight is
// the timezone bug slice 8's review caught; comparing UTC calendar-date
// strings on both sides removes the two-reference-frames mismatch, so "today"
// is always accepted regardless of server timezone. See tests/liveHomework.test.ts.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The stored calendar-date string (UTC) of a Date — the comparison key for deadline validation, identical to setUsecases.setExamDate's toUtcDateString. */
export function toUtcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The concrete deadline INSTANT for a date-only deadline: the very end of that
 * UTC calendar day (23:59:59.999 UTC). `deadlineDateUtcMidnight` is the
 * `new Date("YYYY-MM-DD")` value (UTC midnight) the date input produces.
 * Storing an instant (not just a date) gives deadline enforcement a precise,
 * timezone-unambiguous cutoff to compare `now` against.
 */
export function homeworkDeadlineInstant(deadlineDateUtcMidnight: Date): Date {
  return new Date(deadlineDateUtcMidnight.getTime() + MS_PER_DAY - 1);
}

/** True once `now` is strictly past the assignment's deadline instant — the single server-side gate for "no new attempts/answers". */
export function isDeadlinePassed(deadline: Date, now: Date): boolean {
  return now.getTime() > deadline.getTime();
}

/** Whole days remaining until the deadline (>= 0), for the host status view's "time remaining". 0 once the deadline is today or past. */
export function daysUntilDeadline(deadline: Date, now: Date): number {
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / MS_PER_DAY));
}

// --- Questions ------------------------------------------------------------

/**
 * The assignment's playable questions, in a stable order, drawn from the
 * set's live-eligible cards only (multiple_choice/true_false/type_answer —
 * reuses isLiveEligibleType EXACTLY, same scope cut as live mode). Ordered by
 * card id for a deterministic sequence across page loads (the source card
 * list order isn't guaranteed stable across queries).
 */
export function homeworkQuestions(cards: Card[]): LiveQuestion[] {
  return cards
    .filter((c) => isLiveEligibleType(c.type))
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((c) => ({ cardId: c.id, type: c.type as LiveCardType, payload: c.payload as LiveQuestion["payload"] }));
}

/** Public (answer-stripped) view of a question — reuses live mode's toPublicQuestion so nothing correct-answer-bearing is ever sent to the student before they answer. */
export function toPublicHomeworkQuestion(q: LiveQuestion): PublicLiveQuestion {
  return toPublicQuestion(q);
}

/**
 * Scores one raw answer to one question: base correctness only, via the reused
 * pure isAnswerCorrect. Deliberately NOT scoreAnswer — no speed bonus in
 * homework mode (see this file's header and the ADR). Returns 0/1 so a
 * player's total score is simply their count of correct answers.
 */
export const HOMEWORK_POINTS_PER_CORRECT = 1;
export function scoreHomeworkAnswer(question: LiveQuestion, rawAnswer: string): { correct: boolean; points: number } {
  const correct = isAnswerCorrect(question, rawAnswer);
  return { correct, points: correct ? HOMEWORK_POINTS_PER_CORRECT : 0 };
}

// --- Leaderboard ----------------------------------------------------------

export interface HomeworkLeaderboardInput {
  userId: string;
  displayName: string;
  /** Count of correct answers (recomputed from answer records by the caller — the source of truth, so an in-progress attempt still ranks by what it answered). */
  score: number;
  /** null for an attempt still in progress (or one the deadline passed mid-way). */
  completedAt: Date | null;
}

export interface HomeworkLeaderboardEntry extends HomeworkLeaderboardInput {
  rank: number;
}

/**
 * Individual-only leaderboard (team mode is a deliberate scope cut for this
 * slice — see the roadmap and the ADR). Deterministic ordering, applying the
 * full-tiebreak discipline slice 16's review taught (a partial tiebreak left a
 * real ambiguity):
 *   1. higher score first;
 *   2. among equal scores, the EARLIER finisher first — an in-progress attempt
 *      (completedAt null) always ranks after every completed one at the same
 *      score (nulls sort last);
 *   3. then displayName (locale-aware), then userId, so the order is
 *      TOTALLY determined even when score + completion time tie exactly.
 * `rank` is 1-based and shares the same value for genuine ties (standard
 * competition ranking: 1,2,2,4).
 */
export function homeworkLeaderboard(entries: HomeworkLeaderboardInput[]): HomeworkLeaderboardEntry[] {
  const completedRank = (d: Date | null): number => (d === null ? Number.POSITIVE_INFINITY : d.getTime());
  const sorted = [...entries].sort(
    (a, b) =>
      b.score - a.score ||
      completedRank(a.completedAt) - completedRank(b.completedAt) ||
      a.displayName.localeCompare(b.displayName) ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );

  const out: HomeworkLeaderboardEntry[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const prev = out[i - 1];
    const cur = sorted[i]!;
    // Standard competition ranking: same score AND same completion state ties
    // the rank; anything that changed either breaks the tie to position+1.
    const tiesPrev =
      prev !== undefined &&
      prev.score === cur.score &&
      completedRank(prev.completedAt) === completedRank(cur.completedAt);
    out.push({ ...cur, rank: tiesPrev ? prev!.rank : i + 1 });
  }
  return out;
}
