import type { LiveQuizAnswerRecord } from "../domain/types";

export interface LiveQuizAnswerRecordInput {
  roomCode: string;
  setId: string;
  hostId: string;
  cardId: string;
  userId: string;
  correct: boolean;
  finishedAt: Date;
}

/**
 * Durable storage for slice 16's teacher-insights data — see
 * LiveQuizAnswerRecord's doc comment in core/domain/types.ts for the full
 * shape/rationale. Two call sites:
 *   - liveQuizInsightsUsecases.recordLiveQuizRoundInsights (write side):
 *     called once per finished live round, from the SAME trigger point
 *     slice 15's importPostGameReviewForRoom is called from
 *     (live-server.ts) — an independent, additive write.
 *   - liveQuizInsightsUsecases.getSetInsights (read side): owner-gated
 *     aggregate view for a set's full live-quiz history.
 */
export interface LiveQuizInsightsRepoPort {
  /**
   * Bulk-inserts one row per (room, player, question) from a just-finished
   * round. MUST gracefully ignore any row that collides with the DB-level
   * unique constraint on (roomCode, cardId, userId) — see
   * migrateSqlite.ts/migratePg.ts — rather than throwing, so calling this
   * more than once for the same finished round (e.g. multiple clients each
   * rendering the finished screen, or a reconnecting socket racing a
   * broadcast) never produces duplicate rows and never crashes the caller.
   * No-ops on an empty array.
   */
  recordRoundResults(records: LiveQuizAnswerRecordInput[]): Promise<void>;
  /** Every recorded row across this set's ENTIRE live-quiz history (every round, every player). Unsorted — aggregation happens in core/domain/liveQuizInsights.ts. */
  listBySetId(setId: string): Promise<LiveQuizAnswerRecord[]>;
}
