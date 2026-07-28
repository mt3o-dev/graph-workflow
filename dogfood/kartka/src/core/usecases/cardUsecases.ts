import type { CardRepoPort } from "../ports/cardRepoPort";
import type { SetRepoPort } from "../ports/setRepoPort";
import type { Card, CardPayload, CardType, PageQuery, Paginated } from "../domain/types";
import { validateCardPayload } from "../domain/cardValidation";
import { getOwnedSet } from "./setUsecases";
import { NotFoundError, ForbiddenError } from "../domain/errors";

export interface AddCardInput {
  setId: string;
  ownerId: string;
  type: CardType;
  payload: CardPayload;
}

export async function addCard(
  cardRepo: CardRepoPort,
  setRepo: SetRepoPort,
  input: AddCardInput,
): Promise<Card> {
  await getOwnedSet(setRepo, input.setId, input.ownerId);
  validateCardPayload(input.type, input.payload);
  return cardRepo.create({ setId: input.setId, type: input.type, payload: input.payload });
}

export interface EditCardInput {
  cardId: string;
  ownerId: string;
  payload: CardPayload;
}

export async function getOwnedCard(
  cardRepo: CardRepoPort,
  setRepo: SetRepoPort,
  cardId: string,
  ownerId: string,
): Promise<Card> {
  const card = await cardRepo.findById(cardId);
  if (!card) throw new NotFoundError("Card");
  const set = await setRepo.findById(card.setId);
  if (!set || set.ownerId !== ownerId) throw new ForbiddenError("You do not own this card");
  return card;
}

export async function editCard(
  cardRepo: CardRepoPort,
  setRepo: SetRepoPort,
  input: EditCardInput,
): Promise<Card> {
  const card = await getOwnedCard(cardRepo, setRepo, input.cardId, input.ownerId);
  validateCardPayload(card.type, input.payload);
  return cardRepo.update(input.cardId, { payload: input.payload });
}

export async function deleteCard(
  cardRepo: CardRepoPort,
  setRepo: SetRepoPort,
  cardId: string,
  ownerId: string,
): Promise<void> {
  await getOwnedCard(cardRepo, setRepo, cardId, ownerId);
  await cardRepo.delete(cardId);
}

export async function listCardsInSet(
  cardRepo: CardRepoPort,
  setRepo: SetRepoPort,
  setId: string,
  ownerId: string,
  query: PageQuery,
): Promise<Paginated<Card>> {
  await getOwnedSet(setRepo, setId, ownerId);
  return cardRepo.listBySet(setId, query);
}
