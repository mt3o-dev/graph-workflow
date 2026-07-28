import type { Card, CardPayload, CardType, Paginated, PageQuery } from "../domain/types";

export interface CardRepoPort {
  create(input: { setId: string; type: CardType; payload: CardPayload }): Promise<Card>;
  findById(id: string): Promise<Card | null>;
  update(id: string, input: { payload: CardPayload }): Promise<Card>;
  delete(id: string): Promise<void>;
  listBySet(setId: string, query: PageQuery): Promise<Paginated<Card>>;
  /** All cards belonging to sets owned by `ownerId` (used to build a review session). */
  listAllForOwner(ownerId: string): Promise<Card[]>;
}
