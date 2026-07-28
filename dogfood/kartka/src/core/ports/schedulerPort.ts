import type { ReviewState } from "../domain/types";

/**
 * Persists per-(card,user) SM-2 scheduling state. Named SchedulerPort (rather
 * than ReviewStateRepoPort) because it's the seam the scheduling algorithm
 * (sm2.ts) is driven through — a future alternate algorithm would implement
 * the same port.
 */
export interface DueEntry {
  cardId: string;
  /** null means the card has never been reviewed by this user — always due. */
  state: ReviewState | null;
}

export interface SchedulerPort {
  get(cardId: string, userId: string): Promise<ReviewState | null>;
  upsert(state: ReviewState): Promise<ReviewState>;
  /**
   * Among the given card ids, returns the ones due for review for this user —
   * either never reviewed (state: null) or with dueAt <= now — ordered by
   * dueAt ascending (never-reviewed cards sort first).
   */
  listDue(userId: string, cardIds: string[], now: Date): Promise<DueEntry[]>;
}
