import type { CardSet, Paginated, PageQuery } from "../domain/types";

export interface SetRepoPort {
  create(input: { ownerId: string; title: string; description: string }): Promise<CardSet>;
  findById(id: string): Promise<CardSet | null>;
  listByOwner(ownerId: string, query: PageQuery): Promise<Paginated<CardSet>>;
  delete(id: string): Promise<void>;
}
