import { eq, asc, desc, count } from "drizzle-orm";
import type { PgDb } from "./index";
import { sets, users, cards } from "./schema.pg";
import type { SetRepoPort, SetWithOwner, SetWithOwnerAndCardCount } from "../../core/ports/setRepoPort";
import type { CardSet, PageQuery, Paginated, Visibility } from "../../core/domain/types";
import { newId } from "./ids";
import { generateSlug } from "../../core/domain/slug";

const SORTABLE = { title: sets.title, createdAt: sets.createdAt } as const;
type SortKey = keyof typeof SORTABLE;

function toDomain(row: typeof sets.$inferSelect): CardSet {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    slug: row.slug,
    examDate: row.examDate ?? null,
    createdAt: row.createdAt,
  };
}

// See setRepo.sqlite.ts for why this is a check-then-insert loop rather than
// catching a driver-specific unique-constraint error.
async function uniqueSlug(db: PgDb): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateSlug();
    const [existing] = await db.select({ id: sets.id }).from(sets).where(eq(sets.slug, candidate)).limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique slug after 5 attempts");
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
        slug: await uniqueSlug(db),
        createdAt: new Date(),
      };
      await db.insert(sets).values(row);
      return toDomain(row);
    },

    async findById(id) {
      const [row] = await db.select().from(sets).where(eq(sets.id, id)).limit(1);
      return row ? toDomain(row) : null;
    },

    async findBySlug(slug) {
      const [row] = await db.select().from(sets).where(eq(sets.slug, slug)).limit(1);
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

    async listPublic(query: PageQuery): Promise<Paginated<SetWithOwner>> {
      const page = Math.max(1, query.page);
      const pageSize = Math.min(100, Math.max(1, query.pageSize));
      const sortCol = SORTABLE[(query.sortBy as SortKey) in SORTABLE ? (query.sortBy as SortKey) : "createdAt"];
      const order = query.sortDir === "asc" ? asc(sortCol) : desc(sortCol);

      const [{ value: total }] = await db
        .select({ value: count() })
        .from(sets)
        .where(eq(sets.visibility, "public"));

      const rows = await db
        .select({ set: sets, ownerDisplayName: users.displayName })
        .from(sets)
        .innerJoin(users, eq(sets.ownerId, users.id))
        .where(eq(sets.visibility, "public"))
        .orderBy(order)
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return {
        items: rows.map((r) => ({ ...toDomain(r.set), ownerDisplayName: r.ownerDisplayName })),
        total,
        page,
        pageSize,
      };
    },

    async listAllAdmin(query: PageQuery): Promise<Paginated<SetWithOwnerAndCardCount>> {
      const page = Math.max(1, query.page);
      const pageSize = Math.min(100, Math.max(1, query.pageSize));
      const cardCountExpr = count(cards.id);
      const orderExpr =
        query.sortBy === "cardCount"
          ? query.sortDir === "asc"
            ? asc(cardCountExpr)
            : desc(cardCountExpr)
          : (() => {
              const sortCol = SORTABLE[(query.sortBy as SortKey) in SORTABLE ? (query.sortBy as SortKey) : "createdAt"];
              return query.sortDir === "asc" ? asc(sortCol) : desc(sortCol);
            })();

      const [{ value: total }] = await db.select({ value: count() }).from(sets);

      const rows = await db
        .select({ set: sets, ownerDisplayName: users.displayName, cardCount: cardCountExpr })
        .from(sets)
        .innerJoin(users, eq(sets.ownerId, users.id))
        .leftJoin(cards, eq(cards.setId, sets.id))
        .groupBy(sets.id, users.displayName)
        .orderBy(orderExpr)
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return {
        items: rows.map((r) => ({ ...toDomain(r.set), ownerDisplayName: r.ownerDisplayName, cardCount: r.cardCount })),
        total,
        page,
        pageSize,
      };
    },

    async updateVisibility(id: string, visibility: Visibility): Promise<CardSet> {
      await db.update(sets).set({ visibility }).where(eq(sets.id, id));
      const [row] = await db.select().from(sets).where(eq(sets.id, id)).limit(1);
      if (!row) throw new Error("Set disappeared during visibility update");
      return toDomain(row);
    },

    async updateExamDate(id: string, examDate: Date | null): Promise<CardSet> {
      await db.update(sets).set({ examDate }).where(eq(sets.id, id));
      const [row] = await db.select().from(sets).where(eq(sets.id, id)).limit(1);
      if (!row) throw new Error("Set disappeared during exam date update");
      return toDomain(row);
    },

    async delete(id) {
      await db.delete(sets).where(eq(sets.id, id));
    },
  };
}
