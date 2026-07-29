import type { CardSet, Paginated, PageQuery, Visibility } from "../domain/types";

/** A publicly-listable set enriched with its owner's display name (for the discover page). */
export interface SetWithOwner extends CardSet {
  ownerDisplayName: string;
}

export interface SetRepoPort {
  create(input: { ownerId: string; title: string; description: string }): Promise<CardSet>;
  findById(id: string): Promise<CardSet | null>;
  /** Looks up a set by its immutable share slug. Returns null for unknown slugs (no visibility filtering here — callers decide what "not found" means). */
  findBySlug(slug: string): Promise<CardSet | null>;
  listByOwner(ownerId: string, query: PageQuery): Promise<Paginated<CardSet>>;
  /** Sets with visibility "public" only, joined with owner display name, for the /discover page. */
  listPublic(query: PageQuery): Promise<Paginated<SetWithOwner>>;
  updateVisibility(id: string, visibility: Visibility): Promise<CardSet>;
  delete(id: string): Promise<void>;
}
