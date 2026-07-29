import type { Card, CardPayload, CardType, Paginated, PageQuery } from "../domain/types";

export interface CardRepoPort {
  create(input: { setId: string; type: CardType; payload: CardPayload }): Promise<Card>;
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
