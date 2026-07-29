import { eq, ne, and, count, asc, desc } from "drizzle-orm";
import type { PgDb } from "./index";
import { users, sets } from "./schema.pg";
import type { UserRepoPort } from "../../core/ports/userRepoPort";
import type { User, PageQuery, Paginated, UserWithSetCount } from "../../core/domain/types";
import { newId } from "./ids";

const SORTABLE = { createdAt: users.createdAt, email: users.email, displayName: users.displayName } as const;
type SortKey = keyof typeof SORTABLE;

function toDomain(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    role: row.role,
    banned: row.banned,
    locale: row.locale,
    schedulerPreference: row.schedulerPreference,
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
        schedulerPreference: "sm2" as const,
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

    async listAll(query: PageQuery): Promise<Paginated<UserWithSetCount>> {
      const page = Math.max(1, query.page);
      const pageSize = Math.min(100, Math.max(1, query.pageSize));
      const sortCol = SORTABLE[(query.sortBy as SortKey) in SORTABLE ? (query.sortBy as SortKey) : "createdAt"];
      const order = query.sortDir === "asc" ? asc(sortCol) : desc(sortCol);

      const [{ value: total }] = await db.select({ value: count() }).from(users);

      const rows = await db
        .select({ user: users, setCount: count(sets.id) })
        .from(users)
        .leftJoin(sets, eq(sets.ownerId, users.id))
        .groupBy(users.id)
        .orderBy(order)
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return {
        items: rows.map((r) => ({ ...toDomain(r.user), setCount: r.setCount })),
        total,
        page,
        pageSize,
      };
    },

    async setBanned(id: string, banned: boolean): Promise<User> {
      await db.update(users).set({ banned }).where(eq(users.id, id));
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!row) throw new Error("User disappeared during ban update");
      return toDomain(row);
    },

    async countActiveAdmins(excludingUserId?: string): Promise<number> {
      const conditions = [eq(users.role, "admin"), eq(users.banned, false)];
      if (excludingUserId) conditions.push(ne(users.id, excludingUserId));
      const [{ value }] = await db
        .select({ value: count() })
        .from(users)
        .where(and(...conditions));
      return value;
    },

    async updateSchedulerPreference(id, preference) {
      await db.update(users).set({ schedulerPreference: preference }).where(eq(users.id, id));
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!row) throw new Error("User disappeared during scheduler preference update");
      return toDomain(row);
    },
  };
}
