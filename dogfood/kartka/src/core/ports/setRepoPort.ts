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
  /**
   * Slice 15 (live-quiz post-game review import): looks up one owner's set
   * by an exact `description` match. Used to find-or-create the player's
   * personal "live quiz review" practice set exactly once, reused across
   * every future live round — see liveQuizPostGameUsecases.ts's
   * PRACTICE_SET_MARKER. A description match (not a title match) is
   * deliberate: the set's title is user-visible and localized to whichever
   * locale the player had when it was first created, so it can't be
   * reliably re-matched after a later locale switch; description instead
   * holds a fixed, non-translated internal marker string never shown in any
   * UI, so this lookup is locale-independent. Returns null if this owner
   * has no set with that exact description yet.
   */
  findByOwnerAndDescription(ownerId: string, description: string): Promise<CardSet | null>;
  listByOwner(ownerId: string, query: PageQuery): Promise<Paginated<CardSet>>;
  /** Sets with visibility "public" only, joined with owner display name, for the /discover page. */
  listPublic(query: PageQuery): Promise<Paginated<SetWithOwner>>;
  /** Every set regardless of owner/visibility, joined with owner display name + card count. Admin-only (slice 4) — see adminUsecases.ts. */
  listAllAdmin(query: PageQuery): Promise<Paginated<SetWithOwnerAndCardCount>>;
  updateVisibility(id: string, visibility: Visibility): Promise<CardSet>;
  /** Slice 8 (cram mode): owner-only set/clear of a set's exam date. See setUsecases.setExamDate for the ownership check. */
  updateExamDate(id: string, examDate: Date | null): Promise<CardSet>;
  delete(id: string): Promise<void>;
}
