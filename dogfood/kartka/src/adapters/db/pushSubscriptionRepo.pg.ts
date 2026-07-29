import { eq, and } from "drizzle-orm";
import type { PgDb } from "./index";
import { pushSubscriptions } from "./schema.pg";
import type { PushSubscriptionRepoPort } from "../../core/ports/pushSubscriptionRepoPort";
import type { PushSubscription } from "../../core/domain/types";
import { newId } from "./ids";

function toDomain(row: typeof pushSubscriptions.$inferSelect): PushSubscription {
  return {
    id: row.id,
    userId: row.userId,
    endpoint: row.endpoint,
    p256dhKey: row.p256dhKey,
    authKey: row.authKey,
    createdAt: row.createdAt,
  };
}

export function createPushSubscriptionRepoPg(db: PgDb): PushSubscriptionRepoPort {
  return {
    async upsert(input) {
      const [existing] = await db
        .select()
        .from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, input.userId), eq(pushSubscriptions.endpoint, input.endpoint)))
        .limit(1);

      if (existing) {
        await db
          .update(pushSubscriptions)
          .set({ p256dhKey: input.p256dhKey, authKey: input.authKey })
          .where(eq(pushSubscriptions.id, existing.id));
        return { ...toDomain(existing), p256dhKey: input.p256dhKey, authKey: input.authKey };
      }

      const row = {
        id: newId(),
        userId: input.userId,
        endpoint: input.endpoint,
        p256dhKey: input.p256dhKey,
        authKey: input.authKey,
        createdAt: new Date(),
      };
      await db.insert(pushSubscriptions).values(row);
      return toDomain(row);
    },

    async listByUser(userId) {
      const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      return rows.map(toDomain);
    },

    async listAll() {
      const rows = await db.select().from(pushSubscriptions);
      return rows.map(toDomain);
    },

    async deleteByUserAndEndpoint(userId, endpoint) {
      const [existing] = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
        .limit(1);
      if (!existing) return false;
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, existing.id));
      return true;
    },

    async deleteByEndpoint(endpoint) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    },
  };
}
