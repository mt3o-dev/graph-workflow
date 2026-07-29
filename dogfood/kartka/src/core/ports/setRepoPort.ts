import type { CardSet, Paginated, PageQuery, Visibility } from "../domain/types";

/** A publicly-listable set enriched with its owner's display name (for the discover page). */
export interface SetWithOwner extends CardSet {
  ownerDisplayName: string;
}

/** A set enriched with owner display name + card count, for the admin sets list (slice 4). */
export interface SetWithOwnerAndCardCount extends SetWithOwner {
  cardCount: number;
}

export interface SetRepoPort {
  create(input: { ownerId: string; title: string; description: string }): Promise<CardSet>;
  findById(id: string): Promise<CardSet | null>;
  /** Looks up a set by its immutable share slug. Returns null for unknown slugs (no visibility filtering here — callers decide what "not found" means). */
  findBySlug(slug: string): Promise<CardSet | null>;
  listByOwner(ownerId: string, query: PageQuery): Promise<Paginated<CardSet>>;
  /** Sets with visibility "public" only, joined with owner display name, for the /discover page. */
  listPublic(query: PageQuery): Promise<Paginated<SetWithOwner>>;
  /** Every set regardless of owner/visibility, joined with owner display name + card count. Admin-only (slice 4) — see adminUsecases.ts. */
  listAllAdmin(query: PageQuery): Promise<Paginated<SetWithOwnerAndCardCount>>;
  updateVisibility(id: string, visibility: Visibility): Promise<CardSet>;
  delete(id: string): Promise<void>;
}
