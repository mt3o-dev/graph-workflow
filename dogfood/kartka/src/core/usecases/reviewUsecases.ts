import type { CardRepoPort } from "../ports/cardRepoPort";
import type { SchedulerPort } from "../ports/schedulerPort";
import type { Card, ReviewQuality, ReviewState } from "../domain/types";
import { sm2, sm2InitialState, addDays } from "../domain/sm2";

export interface DueItem {
  card: Card;
  state: ReviewState | null;
}

/** Picks cards due for review for `userId`, ordered by dueAt (never-reviewed cards come first). */
export async function startReviewSession(
  cardRepo: CardRepoPort,
  scheduler: SchedulerPort,
  userId: string,
  now: Date = new Date(),
): Promise<DueItem[]> {
  const allCards = await cardRepo.listAllForOwner(userId);
  if (allCards.length === 0) return [];

  const cardById = new Map(allCards.map((c) => [c.id, c]));
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
  now?: Date;
}

export async function submitReview(scheduler: SchedulerPort, input: SubmitReviewInput): Promise<ReviewState> {
  const now = input.now ?? new Date();
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
