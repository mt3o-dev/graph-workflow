import type { SetRepoPort } from "../ports/setRepoPort";
import type { CardSet, PageQuery, Paginated } from "../domain/types";
import { ForbiddenError, NotFoundError, ValidationError } from "../domain/errors";

export interface CreateSetInput {
  ownerId: string;
  title: string;
  description?: string;
}

export async function createSet(setRepo: SetRepoPort, input: CreateSetInput): Promise<CardSet> {
  const title = input.title.trim();
  if (title.length === 0) throw new ValidationError("Title is required");
  if (title.length > 200) throw new ValidationError("Title is too long");
  return setRepo.create({ ownerId: input.ownerId, title, description: input.description?.trim() ?? "" });
}

export async function listSets(
  setRepo: SetRepoPort,
  ownerId: string,
  query: PageQuery,
): Promise<Paginated<CardSet>> {
  return setRepo.listByOwner(ownerId, query);
}

export async function getOwnedSet(setRepo: SetRepoPort, setId: string, ownerId: string): Promise<CardSet> {
  const set = await setRepo.findById(setId);
  if (!set) throw new NotFoundError("Set");
  if (set.ownerId !== ownerId) throw new ForbiddenError("You do not own this set");
  return set;
}

export async function deleteSet(setRepo: SetRepoPort, setId: string, ownerId: string): Promise<void> {
  await getOwnedSet(setRepo, setId, ownerId);
  await setRepo.delete(setId);
}
