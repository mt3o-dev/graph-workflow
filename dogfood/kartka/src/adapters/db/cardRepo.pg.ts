import { eq, asc, desc, count, inArray } from "drizzle-orm";
import type { PgDb } from "./index";
import { cards, sets } from "./schema.pg";
import type { CardRepoPort } from "../../core/ports/cardRepoPort";
import type { Card, CardType, PageQuery, Paginated } from "../../core/domain/types";
import { newId } from "./ids";

const SORTABLE = { type: cards.type, createdAt: cards.createdAt } as const;
type SortKey = keyof typeof SORTABLE;

function toDomain(row: typeof cards.$inferSelect): Card {
  return {
    id: row.id,
    setId: row.setId,
    type: row.type as CardType,
    payload: row.payload as never,
    createdAt: row.createdAt,
  };
}

export function createCardRepoPg(db: PgDb): CardRepoPort {
  return {
    async create(input) {
      const row = {
        id: newId(),
        setId: input.setId,
        type: input.type,
        payload: input.payload as object,
        createdAt: new Date(),
      };
      await db.insert(cards).values(row);
      return toDomain(row as typeof cards.$inferSelect);
    },

    async findById(id) {
      const [row] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
      return row ? toDomain(row) : null;
    },

    async update(id, input) {
      await db.update(cards).set({ payload: input.payload as object }).where(eq(cards.id, id));
      const updated = await this.findById(id);
      if (!updated) throw new Error("Card disappeared during update");
      return updated;
    },

    async delete(id) {
      await db.delete(cards).where(eq(cards.id, id));
    },

    async listBySet(setId, query: PageQuery): Promise<Paginated<Card>> {
      const page = Math.max(1, query.page);
      const pageSize = Math.min(100, Math.max(1, query.pageSize));
      const sortCol = SORTABLE[(query.sortBy as SortKey) in SORTABLE ? (query.sortBy as SortKey) : "createdAt"];
      const order = query.sortDir === "asc" ? asc(sortCol) : desc(sortCol);

      const [{ value: total }] = await db
        .select({ value: count() })
        .from(cards)
        .where(eq(cards.setId, setId));

      const rows = await db
        .select()
        .from(cards)
        .where(eq(cards.setId, setId))
        .orderBy(order)
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return { items: rows.map(toDomain), total, page, pageSize };
    },

    async listAllForOwner(ownerId) {
      const ownerSetIds = await db.select({ id: sets.id }).from(sets).where(eq(sets.ownerId, ownerId));
      if (ownerSetIds.length === 0) return [];
      const rows = await db
        .select()
        .from(cards)
        .where(inArray(cards.setId, ownerSetIds.map((s) => s.id)));
      return rows.map(toDomain);
    },

    async listAllBySet(setId) {
      const rows = await db.select().from(cards).where(eq(cards.setId, setId));
      return rows.map(toDomain);
    },

    async countBySet(setId) {
      const [{ value }] = await db.select({ value: count() }).from(cards).where(eq(cards.setId, setId));
      return value;
    },
  };
}
