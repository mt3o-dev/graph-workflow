import type { CardType, CardPayload } from "../domain/types";

// TODO(slice 2): implement this port against OpenRouter to let students upload
// text/attachments and get LLM-drafted flashcards back for review before
// saving. Slice 1 only defines the seam — no implementation, no fake/stub
// behavior wired into any use case yet.

export interface CardDraft {
  type: CardType;
  payload: CardPayload;
}

export interface LlmGeneratorPort {
  generateCards(input: { sourceText: string; setId: string; count?: number }): Promise<CardDraft[]>;
}
