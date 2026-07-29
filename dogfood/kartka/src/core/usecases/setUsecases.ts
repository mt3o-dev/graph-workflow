import type { SetRepoPort, SetWithOwner } from "../ports/setRepoPort";
import type { CardRepoPort } from "../ports/cardRepoPort";
import type { UserRepoPort } from "../ports/userRepoPort";
import type { CardSet, CardType, PageQuery, Paginated, Visibility } from "../domain/types";
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

const VALID_VISIBILITIES: Visibility[] = ["private", "unlisted", "public"];

/** Owner-only: changes a set's visibility. Reuses getOwnedSet so the ownership check can't be bypassed. */
export async function setVisibility(
  setRepo: SetRepoPort,
  setId: string,
  ownerId: string,
  visibility: Visibility,
): Promise<CardSet> {
  if (!VALID_VISIBILITIES.includes(visibility)) throw new ValidationError("Invalid visibility value");
  await getOwnedSet(setRepo, setId, ownerId);
  return setRepo.updateVisibility(setId, visibility);
}

export async function listPublicSets(setRepo: SetRepoPort, query: PageQuery): Promise<Paginated<SetWithOwner>> {
  return setRepo.listPublic(query);
}

export interface SharedSetView {
  set: CardSet;
  ownerDisplayName: string;
  cardCount: number;
  typeBreakdown: Partial<Record<CardType, number>>;
}

/**
 * Read-only lookup for the public /s/{slug} share page. Private sets and
 * unknown slugs are indistinguishable (both throw NotFoundError) — see
 * docs/architecture.md / the slice 3 report for why we chose 404-for-both
 * over a 403/404 split.
 */
export async function getSharedSet(
  setRepo: SetRepoPort,
  cardRepo: CardRepoPort,
  userRepo: UserRepoPort,
  slug: string,
): Promise<SharedSetView> {
  const set = await setRepo.findBySlug(slug);
  if (!set || set.visibility === "private") throw new NotFoundError("Set");

  const owner = await userRepo.findById(set.ownerId);
  const cards = await cardRepo.listAllBySet(set.id);
  const typeBreakdown: Partial<Record<CardType, number>> = {};
  for (const card of cards) {
    typeBreakdown[card.type] = (typeBreakdown[card.type] ?? 0) + 1;
  }

  return {
    set,
    ownerDisplayName: owner?.displayName ?? "",
    cardCount: cards.length,
    typeBreakdown,
  };
}

export interface CloneSharedSetInput {
  slug: string;
  newOwnerId: string;
}

/**
 * Clone-on-import: copies a public/unlisted set (title, description, and
 * every card's type+payload) into a brand-new Set owned by `newOwnerId`.
 * New Set id, new slug, new Card ids. No ReviewState rows are created here —
 * per reviewUsecases.ts, ReviewState is created lazily on first review
 * (scheduler.upsert in submitReview), so a freshly cloned card simply has
 * none yet. The source set and its cards are never modified.
 */
export async function cloneSharedSet(
  setRepo: SetRepoPort,
  cardRepo: CardRepoPort,
  input: CloneSharedSetInput,
): Promise<CardSet> {
  const source = await setRepo.findBySlug(input.slug);
  if (!source || source.visibility === "private") throw new NotFoundError("Set");

  const sourceCards = await cardRepo.listAllBySet(source.id);
  const cloned = await setRepo.create({
    ownerId: input.newOwnerId,
    title: source.title,
    description: source.description,
  });

  for (const card of sourceCards) {
    await cardRepo.create({ setId: cloned.id, type: card.type, payload: card.payload });
  }

  return cloned;
}
