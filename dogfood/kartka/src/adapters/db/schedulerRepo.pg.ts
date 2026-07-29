import { and, eq, inArray, lte, gte, asc, count, countDistinct } from "drizzle-orm";
import type { PgDb } from "./index";
import { reviewStates } from "./schema.pg";
import type { Sm2SchedulerPort, DueEntry } from "../../core/ports/schedulerPort";
import type { ReviewState } from "../../core/domain/types";

function toDomain(row: typeof reviewStates.$inferSelect): ReviewState {
  return {
    cardId: row.cardId,
    userId: row.userId,
    easiness: row.easiness,
    interval: row.interval,
    repetitions: row.repetitions,
    dueAt: row.dueAt,
    lastReviewedAt: row.lastReviewedAt,
  };
}

export function createSchedulerRepoPg(db: PgDb): Sm2SchedulerPort {
  return {
    async get(cardId, userId) {
      const [row] = await db
        .select()
        .from(reviewStates)
        .where(and(eq(reviewStates.cardId, cardId), eq(reviewStates.userId, userId)))
        .limit(1);
      return row ? toDomain(row) : null;
    },

    async upsert(state) {
      const existing = await this.get(state.cardId, state.userId);
      const row = {
        cardId: state.cardId,
        userId: state.userId,
        easiness: state.easiness,
        interval: state.interval,
        repetitions: state.repetitions,
        dueAt: state.dueAt,
        lastReviewedAt: state.lastReviewedAt,
      };
      if (existing) {
        await db
          .update(reviewStates)
          .set(row)
          .where(and(eq(reviewStates.cardId, state.cardId), eq(reviewStates.userId, state.userId)));
      } else {
        await db.insert(reviewStates).values(row);
      }
      return state;
    },

    async listDue(userId, cardIds, now): Promise<DueEntry<ReviewState>[]> {
      if (cardIds.length === 0) return [];

      const existingRows = await db
        .select()
        .from(reviewStates)
        .where(and(eq(reviewStates.userId, userId), inArray(reviewStates.cardId, cardIds), lte(reviewStates.dueAt, now)))
        .orderBy(asc(reviewStates.dueAt));

      const stateByCard = new Map(existingRows.map((r) => [r.cardId, toDomain(r)]));

      const allExistingForUser = await db
        .select({ cardId: reviewStates.cardId })
        .from(reviewStates)
        .where(and(eq(reviewStates.userId, userId), inArray(reviewStates.cardId, cardIds)));
      const hasAnyState = new Set(allExistingForUser.map((r) => r.cardId));

      const entries: DueEntry<ReviewState>[] = [];
      for (const cardId of cardIds) {
        if (!hasAnyState.has(cardId)) entries.push({ cardId, state: null });
      }
      for (const cardId of cardIds) {
        const state = stateByCard.get(cardId);
        if (state) entries.push({ cardId, state });
      }
      return entries;
    },

    async countActiveUsersSince(since) {
      const [{ value }] = await db
        .select({ value: countDistinct(reviewStates.userId) })
        .from(reviewStates)
        .where(gte(reviewStates.lastReviewedAt, since));
      return value;
    },

    async countReviewedSince(since) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(reviewStates)
        .where(gte(reviewStates.lastReviewedAt, since));
      return value;
    },
  };
}
