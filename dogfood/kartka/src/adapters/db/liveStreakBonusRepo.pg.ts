import { eq, and, sum } from "drizzle-orm";
import type { PgDb } from "./index";
import { liveStreakBonuses } from "./schema.pg";
import type { LiveStreakBonusRepoPort } from "../../core/ports/liveStreakBonusRepoPort";
import type { LiveStreakBonus } from "../../core/domain/types";
import { newId } from "./ids";

function toDomain(row: typeof liveStreakBonuses.$inferSelect): LiveStreakBonus {
  return {
    id: row.id,
    userId: row.userId,
    cardId: row.cardId,
    roomCode: row.roomCode,
    points: row.points,
    status: row.status,
    awardedAt: row.awardedAt,
    resolvedAt: row.resolvedAt,
  };
}

export function createLiveStreakBonusRepoPg(db: PgDb): LiveStreakBonusRepoPort {
  return {
    async createPending(input, now = new Date()) {
      const row = {
        id: newId(),
        userId: input.userId,
        cardId: input.cardId,
        roomCode: input.roomCode,
        points: input.points,
        status: "pending" as const,
        awardedAt: now,
        resolvedAt: null,
      };
      await db.insert(liveStreakBonuses).values(row);
      return toDomain(row);
    },

    async findUnresolvedByUserAndCard(userId, cardId) {
      const [row] = await db
        .select()
        .from(liveStreakBonuses)
        .where(
          and(
            eq(liveStreakBonuses.userId, userId),
            eq(liveStreakBonuses.cardId, cardId),
            eq(liveStreakBonuses.status, "pending"),
          ),
        )
        .limit(1);
      return row ? toDomain(row) : null;
    },

    async resolve(id, status, resolvedAt) {
      await db.update(liveStreakBonuses).set({ status, resolvedAt }).where(eq(liveStreakBonuses.id, id));
    },

    async sumConfirmedPointsForUser(userId) {
      const [row] = await db
        .select({ total: sum(liveStreakBonuses.points) })
        .from(liveStreakBonuses)
        .where(and(eq(liveStreakBonuses.userId, userId), eq(liveStreakBonuses.status, "confirmed")));
      return Number(row?.total ?? 0);
    },
  };
}
