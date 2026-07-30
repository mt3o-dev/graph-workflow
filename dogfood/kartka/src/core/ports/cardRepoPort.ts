import type { Card, CardPayload, CardType, Paginated, PageQuery } from "../domain/types";

export interface CardRepoPort {
  /**
   * `sourceCardId` (slice 15) is optional and omitted/undefined for every
   * ordinary create call (every pre-slice-15 call site) — only
   * liveQuizPostGameUsecases.ts's import path passes it, to record which
   * source card a review-queue clone came from. See Card.sourceCardId.
   */
  create(input: { setId: string; type: CardType; payload: CardPayload; sourceCardId?: string | null }): Promise<Card>;
  findById(id: string): Promise<Card | null>;
  update(id: string, input: { payload: CardPayload }): Promise<Card>;
  delete(id: string): Promise<void>;
  listBySet(setId: string, query: PageQuery): Promise<Paginated<Card>>;
  /** All cards belonging to sets owned by `ownerId` (used to build a review session). */
  listAllForOwner(ownerId: string): Promise<Card[]>;
  /** All cards in one set, unpaginated (used by clone-on-import and the share-page card-count/type breakdown, slice 3). */
  listAllBySet(setId: string): Promise<Card[]>;
  /** Cheap count for one set — avoids loading full card rows where only a number is needed. */
  countBySet(setId: string): Promise<number>;
}
