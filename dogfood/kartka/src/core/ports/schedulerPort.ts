import type { ReviewState, FsrsReviewState } from "../domain/types";

/**
 * Persists per-(card,user) scheduling state for one scheduling algorithm.
 * Named SchedulerPort (rather than ReviewStateRepoPort) because it's the
 * seam a scheduling algorithm (sm2.ts, fsrs.ts) is driven through.
 *
 * Parameterized over the state shape (`TState`) rather than hardcoded to
 * SM-2's {easiness,interval,repetitions} — slice 5 adds FSRS, whose state
 * shape ({difficulty,stability}) means something genuinely different, not
 * just a relabeling. Forcing it into SM-2's fields would either lose
 * precision or make the fields lie about what they hold; a type parameter
 * keeps each algorithm's adapter honest about its own state. See
 * Sm2SchedulerPort / FsrsSchedulerPort below, and reviewUsecases.ts for how
 * the review usecase picks one implementation per the reviewing user's
 * `schedulerPreference`.
 */
export interface DueEntry<TState> {
  cardId: string;
  /** null means the card has never been reviewed by this user under this scheduler — always due. */
  state: TState | null;
}

export interface SchedulerPort<TState> {
  get(cardId: string, userId: string): Promise<TState | null>;
  upsert(state: TState): Promise<TState>;
  /**
   * Among the given card ids, returns the ones due for review for this user —
   * either never reviewed (state: null) or with dueAt <= now — ordered by
   * dueAt ascending (never-reviewed cards sort first).
   */
  listDue(userId: string, cardIds: string[], now: Date): Promise<DueEntry<TState>[]>;

  /**
   * Distinct users with at least one state row whose lastReviewedAt falls
   * at/after `since`. Admin analytics "active users" proxy (slice 4) —
   * summed across both scheduler implementations in adminUsecases.ts, see
   * the caveat there about users active under both counting twice.
   */
  countActiveUsersSince(since: Date): Promise<number>;

  /**
   * Count of state rows whose lastReviewedAt falls at/after `since`. Admin
   * analytics "review volume" proxy (slice 4) — undercounts true review
   * volume when the same card is reviewed more than once in the window,
   * since only the latest review overwrites this row's timestamp. See
   * adminUsecases.ts.
   */
  countReviewedSince(since: Date): Promise<number>;
}

/** SM-2's SchedulerPort instantiation — the slice-1 scheduler, unchanged. */
export type Sm2SchedulerPort = SchedulerPort<ReviewState>;

/** FSRS's SchedulerPort instantiation — the slice-5 opt-in scheduler. See fsrs.ts. */
export type FsrsSchedulerPort = SchedulerPort<FsrsReviewState>;
