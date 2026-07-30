import type { CardRepoPort } from "../ports/cardRepoPort";
import type { SetRepoPort } from "../ports/setRepoPort";
import type { Sm2SchedulerPort, FsrsSchedulerPort } from "../ports/schedulerPort";
import type { LiveStreakBonusRepoPort } from "../ports/liveStreakBonusRepoPort";
import type { Card, ReviewQuality, ReviewState, FsrsReviewState, SchedulerPreference } from "../domain/types";
import { sm2, sm2InitialState, addDays } from "../domain/sm2";
import { fsrs, fsrsInitialState, fsrsGradeFromQuality, bootstrapFsrsFromSm2 } from "../domain/fsrs";
import { getOwnedCard } from "./cardUsecases";

/**
 * Slice 14: the same 0-5 SM-2 quality threshold sm2.ts itself uses to decide
 * "pass" (repetitions grow) vs. "fail" (repetitions reset) — see sm2()'s doc
 * comment. Reused here rather than inventing a second correctness rule for
 * whether a real review "counts" for confirming a live-quiz streak bonus.
 */
const PASSING_QUALITY_THRESHOLD = 3;

/**
 * Slice 14 side effect, appended after the real SM-2/FSRS scheduling above
 * has already succeeded — see submitReview's doc comment for why this is
 * deliberately NOT folded into submitSm2Review/submitFsrsReview themselves.
 * Resolves AT MOST one unresolved ("pending") streak-bonus record for this
 * exact (userId, cardId) pair: 'confirmed' (its points now count toward the
 * lasting total, see LiveStreakBonusRepoPort.sumConfirmedPointsForUser) if
 * this review's quality passes, 'forfeited' (no points, ever) otherwise.
 * Because findUnresolvedByUserAndCard only ever returns an already-'pending'
 * record, and this is the only place that resolves one, a card can only ever
 * be resolved once — a second, third, ... review of the same card afterward
 * finds nothing left to resolve and is a no-op.
 */
async function resolvePendingStreakBonus(
  bonusRepo: LiveStreakBonusRepoPort,
  userId: string,
  cardId: string,
  quality: ReviewQuality,
  now: Date,
): Promise<void> {
  const pending = await bonusRepo.findUnresolvedByUserAndCard(userId, cardId);
  if (!pending) return;
  const status = quality >= PASSING_QUALITY_THRESHOLD ? "confirmed" : "forfeited";
  await bonusRepo.resolve(pending.id, status, now);
}

/** Both scheduler implementations, bundled — see schedulerPort.ts for why there are two. */
export interface Schedulers {
  sm2: Sm2SchedulerPort;
  fsrs: FsrsSchedulerPort;
}

export interface DueItem {
  card: Card;
  /** Whichever scheduler the reviewing user is on; the review UI only cares whether it's null (never reviewed), not its internal shape. */
  state: ReviewState | FsrsReviewState | null;
}

/** Picks cards due for review for `userId` under their chosen scheduler, ordered by dueAt (never-reviewed cards come first). */
export async function startReviewSession(
  cardRepo: CardRepoPort,
  schedulers: Schedulers,
  userId: string,
  schedulerPreference: SchedulerPreference,
  now: Date = new Date(),
): Promise<DueItem[]> {
  const allCards = await cardRepo.listAllForOwner(userId);
  if (allCards.length === 0) return [];

  const cardById = new Map(allCards.map((c) => [c.id, c]));
  const scheduler = schedulerPreference === "fsrs" ? schedulers.fsrs : schedulers.sm2;
  const dueEntries = await scheduler.listDue(
    userId,
    allCards.map((c) => c.id),
    now,
  );

  return dueEntries
    .map((entry) => {
      const card = cardById.get(entry.cardId);
      return card ? { card, state: entry.state } : null;
    })
    .filter((item): item is DueItem => item !== null);
}

export interface SubmitReviewInput {
  cardId: string;
  userId: string;
  quality: ReviewQuality;
  schedulerPreference: SchedulerPreference;
  now?: Date;
}

/**
 * Dispatches to the SM-2 or FSRS update path based on `input.schedulerPreference`
 * (the reviewing user's own setting — see authUsecases.changeSchedulerPreference
 * for how that's set). This is the single most reused, most-tested function in
 * the app — every `/api/review/*` endpoint and the offline-sync replay path
 * all funnel through it, and every prior slice's review behavior depends on it
 * being unchanged.
 *
 * Slice 14 adds ONE thing here: `bonusRepo` (optional — omit it and behavior
 * is byte-for-byte what it was before this slice, which is exactly why every
 * pre-existing call/test that doesn't pass it still passes unchanged). When
 * provided, AFTER the real scheduling result above has already been computed
 * and persisted, this checks for — and resolves — at most one pending
 * live-quiz streak bonus for this (userId, cardId) pair. See
 * resolvePendingStreakBonus's doc comment for the exact resolution rule.
 * This is a pure side effect bolted on at the end; it does not read, does
 * not influence, and cannot change the SM-2/FSRS result being returned.
 */
export async function submitReview(
  schedulers: Schedulers,
  input: SubmitReviewInput,
  bonusRepo?: LiveStreakBonusRepoPort,
): Promise<ReviewState | FsrsReviewState> {
  const now = input.now ?? new Date();
  const result =
    input.schedulerPreference === "fsrs"
      ? await submitFsrsReview(schedulers.fsrs, schedulers.sm2, input, now)
      : await submitSm2Review(schedulers.sm2, input, now);

  if (bonusRepo) {
    await resolvePendingStreakBonus(bonusRepo, input.userId, input.cardId, input.quality, now);
  }

  return result;
}

async function submitSm2Review(scheduler: Sm2SchedulerPort, input: SubmitReviewInput, now: Date): Promise<ReviewState> {
  const existing = await scheduler.get(input.cardId, input.userId);
  const base = existing ?? { ...sm2InitialState(), cardId: input.cardId, userId: input.userId, dueAt: now, lastReviewedAt: null as Date | null };

  const result = sm2({
    easiness: base.easiness,
    interval: base.interval,
    repetitions: base.repetitions,
    quality: input.quality,
  });

  const next: ReviewState = {
    cardId: input.cardId,
    userId: input.userId,
    easiness: result.easiness,
    interval: result.interval,
    repetitions: result.repetitions,
    dueAt: addDays(now, result.interval),
    lastReviewedAt: now,
  };

  return scheduler.upsert(next);
}

/**
 * FSRS review path. If this (card,user) has no FSRS state yet, checks
 * whether an SM-2 ReviewState already exists for it (i.e. this card was
 * reviewed before the user switched sm2 -> fsrs) and bootstraps from that
 * via bootstrapFsrsFromSm2 instead of starting fresh — see fsrs.ts for the
 * exact mapping and reasoning. A card with no history under either
 * scheduler is genuinely new and gets FSRS's normal fresh-card S0/D0 path.
 */
async function submitFsrsReview(
  fsrsScheduler: FsrsSchedulerPort,
  sm2Scheduler: Sm2SchedulerPort,
  input: SubmitReviewInput,
  now: Date,
): Promise<FsrsReviewState> {
  const existing = await fsrsScheduler.get(input.cardId, input.userId);

  let base: { difficulty: number; stability: number; reps: number; lastReviewedAt: Date | null };
  if (existing) {
    base = existing;
  } else {
    const sm2State = await sm2Scheduler.get(input.cardId, input.userId);
    base = sm2State
      ? { ...bootstrapFsrsFromSm2(sm2State), lastReviewedAt: sm2State.lastReviewedAt }
      : { ...fsrsInitialState(), lastReviewedAt: null };
  }

  const grade = fsrsGradeFromQuality(input.quality);
  const result = fsrs({
    difficulty: base.difficulty,
    stability: base.stability,
    reps: base.reps,
    lastReviewedAt: base.lastReviewedAt,
    grade,
    now,
  });

  const next: FsrsReviewState = {
    cardId: input.cardId,
    userId: input.userId,
    difficulty: result.difficulty,
    stability: result.stability,
    reps: result.reps,
    dueAt: addDays(now, result.intervalDays),
    lastReviewedAt: now,
  };

  return fsrsScheduler.upsert(next);
}

/** Default cap for GET /api/review/offline-bundle — see reviewUsecases.getOfflineBundle. */
export const OFFLINE_BUNDLE_LIMIT = 50;

/**
 * Slice 6 (offline review): the same due-card selection as startReviewSession,
 * capped to `limit` cards, for the client to cache in IndexedDB and score
 * itself while offline. Ownership is implicit — cardRepo.listAllForOwner is
 * already scoped to `userId`'s own cards (see startReviewSession), so this
 * never leaks another user's cards or answers.
 */
export async function getOfflineBundle(
  cardRepo: CardRepoPort,
  schedulers: Schedulers,
  userId: string,
  schedulerPreference: SchedulerPreference,
  limit: number = OFFLINE_BUNDLE_LIMIT,
  now: Date = new Date(),
): Promise<Card[]> {
  const due = await startReviewSession(cardRepo, schedulers, userId, schedulerPreference, now);
  return due.slice(0, limit).map((d) => d.card);
}

/** One offline-completed review, as queued client-side (see src/client/offline/db.ts) and posted to POST /api/review/sync. */
export interface OfflineReviewItem {
  cardId: string;
  quality: ReviewQuality;
  answeredAt: Date;
}

export interface SyncOutcome {
  cardId: string;
  answeredAt: Date;
}

export interface SyncSkip {
  cardId: string;
  reason: "not_owned" | "invalid_quality" | "invalid_timestamp";
}

export interface SyncResult {
  applied: SyncOutcome[];
  skipped: SyncSkip[];
}

/**
 * Replays a batch of offline-queued reviews server-side (POST /api/review/sync).
 *
 * Ownership: every cardId is ownership-checked via getOwnedCard before any of
 * its reviews are applied (paranoid — this class of bug has been the most
 * common review finding across prior slices). An unowned/unknown card skips
 * *all* of its queued reviews rather than applying some and dropping others.
 *
 * Chronological replay: reviews for the same card can arrive out of order in
 * one batch (multiple offline reviews of the same due card before
 * reconnecting) — SM-2/FSRS state is sequential, so each card's reviews are
 * sorted by client-supplied `answeredAt` and replayed one at a time through
 * submitReview, oldest first, exactly mirroring what would have happened had
 * each review gone straight to the server when it happened.
 *
 * Timestamp clamping (exact rule, and why):
 *  - `answeredAt` is never allowed to be after `serverNow` — clamp down to
 *    serverNow. A client clock can't be trusted to not be skewed into the
 *    future; scheduling a card as "reviewed in the future" would let a user
 *    manipulate their own due dates outward.
 *  - `answeredAt` is never allowed to be before this card's last *known*
 *    lastReviewedAt for this user — clamped *up* to that floor, not
 *    rejected outright. The floor starts as whatever is already persisted
 *    (scheduler.get before replay begins) and advances to each replayed
 *    review's own (already-clamped) timestamp as the batch is applied, so a
 *    second offline review of the same card can never be scheduled as
 *    happening before the first one in the same batch either. Clamping
 *    (rather than rejecting) is chosen over dropping the review entirely:
 *    the user did do the review, and SM-2/FSRS can't sensibly rewind time,
 *    but silently discarding a completed review would lose real study
 *    signal for no benefit over just treating it as "reviewed right after
 *    the previous one."
 *  - Invalid/unparseable timestamps and out-of-range (non-0..5 integer)
 *    quality values are skipped outright (skip reason invalid_timestamp /
 *    invalid_quality) rather than clamped/coerced, since there's no sensible
 *    default for genuinely malformed input.
 */
export async function syncOfflineReviews(
  cardRepo: CardRepoPort,
  setRepo: SetRepoPort,
  schedulers: Schedulers,
  userId: string,
  schedulerPreference: SchedulerPreference,
  items: OfflineReviewItem[],
  serverNow: Date = new Date(),
  bonusRepo?: LiveStreakBonusRepoPort,
): Promise<SyncResult> {
  const applied: SyncOutcome[] = [];
  const skipped: SyncSkip[] = [];

  const byCard = new Map<string, OfflineReviewItem[]>();
  for (const item of items) {
    const bucket = byCard.get(item.cardId);
    if (bucket) bucket.push(item);
    else byCard.set(item.cardId, [item]);
  }

  for (const [cardId, cardItems] of byCard) {
    try {
      await getOwnedCard(cardRepo, setRepo, cardId, userId);
    } catch {
      for (const _item of cardItems) skipped.push({ cardId, reason: "not_owned" });
      continue;
    }

    const sorted = [...cardItems].sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime());
    const scheduler = schedulerPreference === "fsrs" ? schedulers.fsrs : schedulers.sm2;
    const existing = await scheduler.get(cardId, userId);
    let floor = existing?.lastReviewedAt ?? null;

    for (const item of sorted) {
      if (!Number.isInteger(item.quality) || item.quality < 0 || item.quality > 5) {
        skipped.push({ cardId, reason: "invalid_quality" });
        continue;
      }
      if (Number.isNaN(item.answeredAt.getTime())) {
        skipped.push({ cardId, reason: "invalid_timestamp" });
        continue;
      }

      let ts = item.answeredAt;
      if (ts.getTime() > serverNow.getTime()) ts = serverNow;
      if (floor && ts.getTime() < floor.getTime()) ts = floor;

      await submitReview(
        schedulers,
        {
          cardId,
          userId,
          quality: item.quality as ReviewQuality,
          schedulerPreference,
          now: ts,
        },
        bonusRepo,
      );

      floor = ts;
      applied.push({ cardId, answeredAt: ts });
    }
  }

  return { applied, skipped };
}
