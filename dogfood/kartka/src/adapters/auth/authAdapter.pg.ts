import { eq, lt } from "drizzle-orm";
import type { PgDb } from "../db/index";
import { sessions } from "../db/schema.pg";
import { newId } from "../db/ids";
import type { AuthPort } from "../../core/ports/authPort";
import type { Session } from "../../core/domain/types";
import { signValue, verifyValue } from "./cookieSigning";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function toDomain(row: typeof sessions.$inferSelect): Session {
  return { id: row.id, userId: row.userId, createdAt: row.createdAt, expiresAt: row.expiresAt };
}

export function createAuthAdapterPg(db: PgDb, sessionSecret: string): AuthPort {
  return {
    async hashPassword(plain) {
      return Bun.password.hash(plain, { algorithm: "bcrypt", cost: 10 });
    },

    async verifyPassword(plain, hash) {
      return Bun.password.verify(plain, hash);
    },

    async createSession(userId) {
      const now = new Date();
      const row = {
        id: newId(),
        userId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      };
      await db.insert(sessions).values(row);
      return toDomain(row);
    },

    async getSession(sessionId) {
      const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
      if (!row) return null;
      const session = toDomain(row);
      if (session.expiresAt.getTime() < Date.now()) {
        await db.delete(sessions).where(eq(sessions.id, sessionId));
        return null;
      }
      return session;
    },

    async destroySession(sessionId) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    },

    signCookieValue(sessionId) {
      return signValue(sessionId, sessionSecret);
    },

    verifyCookieValue(cookieValue) {
      return verifyValue(cookieValue, sessionSecret);
    },
  };
}

/** Best-effort cleanup of expired sessions; safe to call periodically or on boot. */
export async function pruneExpiredSessionsPg(db: PgDb): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
