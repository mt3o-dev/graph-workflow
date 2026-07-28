import { eq, asc, desc, count } from "drizzle-orm";
import type { PgDb } from "./index";
import { sets } from "./schema.pg";
import type { SetRepoPort } from "../../core/ports/setRepoPort";
import type { CardSet, PageQuery, Paginated } from "../../core/domain/types";
import { newId } from "./ids";

const SORTABLE = { title: sets.title, createdAt: sets.createdAt } as const;
type SortKey = keyof typeof SORTABLE;

function toDomain(row: typeof sets.$inferSelect): CardSet {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    createdAt: row.createdAt,
  };
}

export function createSetRepoPg(db: PgDb): SetRepoPort {
  return {
    async create(input) {
      const row = {
        id: newId(),
        ownerId: input.ownerId,
        title: input.title,
        description: input.description,
        visibility: "private" as const,
        createdAt: new Date(),
      };
      await db.insert(sets).values(row);
      return toDomain(row);
    },

    async findById(id) {
      const [row] = await db.select().from(sets).where(eq(sets.id, id)).limit(1);
      return row ? toDomain(row) : null;
    },

    async listByOwner(ownerId, query: PageQuery): Promise<Paginated<CardSet>> {
      const page = Math.max(1, query.page);
      const pageSize = Math.min(100, Math.max(1, query.pageSize));
      const sortCol = SORTABLE[(query.sortBy as SortKey) in SORTABLE ? (query.sortBy as SortKey) : "createdAt"];
      const order = query.sortDir === "asc" ? asc(sortCol) : desc(sortCol);

      const [{ value: total }] = await db
        .select({ value: count() })
        .from(sets)
        .where(eq(sets.ownerId, ownerId));

      const rows = await db
        .select()
        .from(sets)
        .where(eq(sets.ownerId, ownerId))
        .orderBy(order)
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return { items: rows.map(toDomain), total, page, pageSize };
    },

    async delete(id) {
      await db.delete(sets).where(eq(sets.id, id));
    },
  };
}
