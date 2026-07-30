import type { LiveStreakBonus } from "../domain/types";

export interface CreatePendingBonusInput {
  userId: string;
  cardId: string;
  roomCode: string;
  points: number;
}

/**
 * Durable storage for slice 14's streak-bonus confirmation mechanism — see
 * LiveStreakBonus's doc comment in core/domain/types.ts for the full
 * lifecycle. Two very different call sites use this port:
 *   - liveQuizUsecases.submitLiveAnswer (live-round side): creates a
 *     'pending' record when a streak just crossed the threshold.
 *   - reviewUsecases.submitReview (real spaced-repetition side, potentially
 *     days later): resolves that same record to 'confirmed'/'forfeited'.
 */
export interface LiveStreakBonusRepoPort {
  /**
   * Creates a new 'pending' record. Callers MUST first check
   * findUnresolvedByUserAndCard themselves and skip creating a new one if an
   * unresolved record already exists for that (userId, cardId) pair — this
   * repo does not enforce that rule itself (matches this codebase's existing
   * pattern of usecases owning invariants, repos owning storage — see e.g.
   * pushSubscriptionRepoPort's upsert-by-ownership split).
   */
  createPending(input: CreatePendingBonusInput, now?: Date): Promise<LiveStreakBonus>;
  /**
   * The single unresolved ('pending') record for this (userId, cardId) pair,
   * if any. Used both to avoid a duplicate pending record on a new streak
   * crossing for a card that already has one outstanding, and to find what
   * to resolve on the player's next real review of that card.
   */
  findUnresolvedByUserAndCard(userId: string, cardId: string): Promise<LiveStreakBonus | null>;
  /**
   * Marks one record 'confirmed' or 'forfeited'. Callers are responsible for
   * only ever resolving a record found via findUnresolvedByUserAndCard (i.e.
   * checking it's still 'pending' first) — this is what makes "only the
   * first subsequent review resolves it" hold; see submitReview.
   */
  resolve(id: string, status: "confirmed" | "forfeited", resolvedAt: Date): Promise<void>;
  /**
   * Live SUM of every 'confirmed' record's points for one user — the
   * lasting total surfaced on the account settings page. Computed on read
   * (not a separately-synced running counter) to avoid drift, per the
   * roadmap's own preference for this slice.
   */
  sumConfirmedPointsForUser(userId: string): Promise<number>;
}
