import type { CardRepoPort } from "../ports/cardRepoPort";
import type { Sm2SchedulerPort, FsrsSchedulerPort } from "../ports/schedulerPort";
import type { Card, ReviewQuality, ReviewState, FsrsReviewState, SchedulerPreference } from "../domain/types";
import { sm2, sm2InitialState, addDays } from "../domain/sm2";
import { fsrs, fsrsInitialState, fsrsGradeFromQuality, bootstrapFsrsFromSm2 } from "../domain/fsrs";

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

/** Dispatches to the SM-2 or FSRS update path based on `input.schedulerPreference` (the reviewing user's own setting — see authUsecases.changeSchedulerPreference for how that's set). */
export async function submitReview(schedulers: Schedulers, input: SubmitReviewInput): Promise<ReviewState | FsrsReviewState> {
  const now = input.now ?? new Date();
  return input.schedulerPreference === "fsrs"
    ? submitFsrsReview(schedulers.fsrs, schedulers.sm2, input, now)
    : submitSm2Review(schedulers.sm2, input, now);
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
