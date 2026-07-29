import { and, eq, inArray, lte, gte, asc, count, countDistinct } from "drizzle-orm";
import type { SqliteDb } from "./index";
import { fsrsReviewStates } from "./schema.sqlite";
import type { FsrsSchedulerPort, DueEntry } from "../../core/ports/schedulerPort";
import type { FsrsReviewState } from "../../core/domain/types";

// Mirrors schedulerRepo.sqlite.ts field-for-field, just against the FSRS
// table/shape — see docs/architecture.md's "why two schema files" note and
// core/ports/schedulerPort.ts for why FSRS gets its own adapter+table
// instead of sharing SM-2's.

function toDomain(row: typeof fsrsReviewStates.$inferSelect): FsrsReviewState {
  return {
    cardId: row.cardId,
    userId: row.userId,
    difficulty: row.difficulty,
    stability: row.stability,
    reps: row.reps,
    dueAt: row.dueAt,
    lastReviewedAt: row.lastReviewedAt,
  };
}

export function createFsrsSchedulerRepoSqlite(db: SqliteDb): FsrsSchedulerPort {
  return {
    async get(cardId, userId) {
      const [row] = await db
        .select()
        .from(fsrsReviewStates)
        .where(and(eq(fsrsReviewStates.cardId, cardId), eq(fsrsReviewStates.userId, userId)))
        .limit(1);
      return row ? toDomain(row) : null;
    },

    async upsert(state) {
      const existing = await this.get(state.cardId, state.userId);
      const row = {
        cardId: state.cardId,
        userId: state.userId,
        difficulty: state.difficulty,
        stability: state.stability,
        reps: state.reps,
        dueAt: state.dueAt,
        lastReviewedAt: state.lastReviewedAt,
      };
      if (existing) {
        await db
          .update(fsrsReviewStates)
          .set(row)
          .where(and(eq(fsrsReviewStates.cardId, state.cardId), eq(fsrsReviewStates.userId, state.userId)));
      } else {
        await db.insert(fsrsReviewStates).values(row);
      }
      return state;
    },

    async listDue(userId, cardIds, now): Promise<DueEntry<FsrsReviewState>[]> {
      if (cardIds.length === 0) return [];

      const existingRows = await db
        .select()
        .from(fsrsReviewStates)
        .where(and(eq(fsrsReviewStates.userId, userId), inArray(fsrsReviewStates.cardId, cardIds), lte(fsrsReviewStates.dueAt, now)))
        .orderBy(asc(fsrsReviewStates.dueAt));

      const stateByCard = new Map(existingRows.map((r) => [r.cardId, toDomain(r)]));

      const allExistingForUser = await db
        .select({ cardId: fsrsReviewStates.cardId })
        .from(fsrsReviewStates)
        .where(and(eq(fsrsReviewStates.userId, userId), inArray(fsrsReviewStates.cardId, cardIds)));
      const hasAnyState = new Set(allExistingForUser.map((r) => r.cardId));

      const entries: DueEntry<FsrsReviewState>[] = [];
      // Never-reviewed cards are always due, and sort first.
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
        .select({ value: countDistinct(fsrsReviewStates.userId) })
        .from(fsrsReviewStates)
        .where(gte(fsrsReviewStates.lastReviewedAt, since));
      return value;
    },

    async countReviewedSince(since) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(fsrsReviewStates)
        .where(gte(fsrsReviewStates.lastReviewedAt, since));
      return value;
    },
  };
}
