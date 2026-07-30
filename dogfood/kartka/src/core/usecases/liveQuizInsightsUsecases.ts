import type { LiveSessionPort } from "../ports/liveSessionPort";
import type { LiveQuizInsightsRepoPort } from "../ports/liveQuizInsightsRepoPort";
import type { SetRepoPort } from "../ports/setRepoPort";
import type { CardRepoPort } from "../ports/cardRepoPort";
import { isLiveEligibleType } from "../domain/liveQuiz";
import { aggregateQuestionStats, aggregateStudentStats, type QuestionStat, type StudentStat } from "../domain/liveQuizInsights";
import { getOwnedSet } from "./setUsecases";
import { NotFoundError, ValidationError } from "../domain/errors";

/**
 * Slice 16 (teacher insights): the impure, DB-writing counterpart to
 * core/domain/liveQuizInsights.ts's pure aggregation. Two independent
 * responsibilities live in this one file (write side + read side), mirroring
 * liveQuizPostGameUsecases.ts's own "one usecase file per finished-round
 * feature" shape.
 */

export interface RecordLiveQuizInsightsDeps {
  liveSessionPort: LiveSessionPort;
  insightsRepo: LiveQuizInsightsRepoPort;
}

/**
 * Writes one durable row per (player, question) for a just-finished live
 * round — see LiveQuizAnswerRecord's doc comment in core/domain/types.ts.
 * Intended to be called from the SAME finished-round trigger point
 * liveQuizPostGameUsecases.importPostGameReviewForRoom already is (see
 * live-server.ts): an INDEPENDENT, ADDITIVE write, never a modification of
 * that function or its logic. Throws ValidationError if called on a room
 * that hasn't finished yet (mirrors importPostGameReviewForRoom's own
 * guard), NotFoundError for an unknown room code.
 *
 * Idempotent by construction, same category of fix as slice 15's review
 * found (see LiveQuizAnswerRecord's doc comment): the DB-level unique index
 * on (roomCode, cardId, userId) plus the repo's onConflictDoNothing() means
 * calling this more than once for the same finished round — e.g. several
 * clients each rendering the finished screen, or a reconnecting socket
 * racing a broadcast — never produces duplicate rows. A player who never
 * answered a given question still gets a row (correct: false) — "how many
 * times has this question been ASKED" (roadmap point 2) counts every
 * exposure, not just answered ones, matching how
 * computeMissedQuestionsForPlayer already treats "unanswered" as a real
 * miss for the post-game-review side.
 */
export async function recordLiveQuizRoundInsights(deps: RecordLiveQuizInsightsDeps, code: string, now: Date = new Date()): Promise<void> {
  const room = await deps.liveSessionPort.getRoom(code);
  if (!room) throw new NotFoundError("Room");
  if (room.phase !== "finished") {
    throw new ValidationError("Insights can only be recorded once the room has finished");
  }

  const records = [];
  for (const player of Object.values(room.players)) {
    for (const question of room.questions) {
      const answer = player.answers[question.cardId];
      records.push({
        roomCode: room.code,
        setId: room.setId,
        hostId: room.hostId,
        cardId: question.cardId,
        userId: player.userId,
        correct: answer?.correct ?? false,
        finishedAt: now,
      });
    }
  }
  await deps.insightsRepo.recordRoundResults(records);
}

export interface SetInsights {
  questionStats: QuestionStat[];
  studentStats: StudentStat[];
}

export interface GetSetInsightsDeps {
  setRepo: SetRepoPort;
  cardRepo: CardRepoPort;
  insightsRepo: LiveQuizInsightsRepoPort;
}

/**
 * Owner-gated aggregate view of a set's ENTIRE live-quiz history (roadmap
 * points 2+3). Reuses getOwnedSet — the exact same ownership check every
 * other owner-only action in this app uses — so a non-owner gets the same
 * NotFoundError/ForbiddenError as e.g. viewing someone else's set's cards,
 * BEFORE any insights data is ever read. This re-derives ownership from
 * `setId` itself every call; it never trusts a caller-supplied set already
 * being "the right one" (roadmap point 5's paranoia note) — a set that
 * somehow accumulated rounds hosted by a DIFFERENT user (shouldn't be
 * possible, since createLiveSession already requires getOwnedSet at room
 * creation time) would still only be viewable by ITS OWNER here, never by
 * whoever happened to host a round of it.
 */
export async function getSetInsights(deps: GetSetInsightsDeps, setId: string, ownerId: string): Promise<SetInsights> {
  await getOwnedSet(deps.setRepo, setId, ownerId);

  const cards = await deps.cardRepo.listAllBySet(setId);
  const liveEligibleCardIds = cards.filter((c) => isLiveEligibleType(c.type)).map((c) => c.id);

  const records = await deps.insightsRepo.listBySetId(setId);

  return {
    questionStats: aggregateQuestionStats(liveEligibleCardIds, records),
    studentStats: aggregateStudentStats(records),
  };
}
