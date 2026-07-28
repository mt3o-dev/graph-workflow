import { eq, count } from "drizzle-orm";
import type { PgDb } from "./index";
import { users } from "./schema.pg";
import type { UserRepoPort } from "../../core/ports/userRepoPort";
import type { User } from "../../core/domain/types";
import { newId } from "./ids";

function toDomain(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    role: row.role,
    banned: row.banned,
    locale: row.locale,
    createdAt: row.createdAt,
  };
}

export function createUserRepoPg(db: PgDb): UserRepoPort {
  return {
    async create(input) {
      const row = {
        id: newId(),
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: input.role ?? "student",
        banned: false,
        locale: input.locale ?? "pl",
        createdAt: new Date(),
      };
      await db.insert(users).values(row);
      return toDomain(row);
    },

    async findById(id) {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return row ? toDomain(row) : null;
    },

    async findByEmail(email) {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return row ? toDomain(row) : null;
    },

    async count() {
      const [{ value }] = await db.select({ value: count() }).from(users);
      return value;
    },
  };
}
