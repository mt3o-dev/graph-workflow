import type { CardDraft } from "../domain/types";

// Implemented by src/adapters/llm/openRouterAdapter.ts (slice 2). Only
// adjustment from the slice-1 seam: `userId` was added to the input so the
// implementing adapter can attribute every OpenRouter call it logs to
// llm_call_log to the requesting student (see core/usecases/llmUsecases.ts).

export interface GenerateCardsInput {
  sourceText: string;
  setId: string;
  userId: string;
  /** Roughly how many cards to propose. Adapters may return fewer if the source material is thin. */
  count?: number;
}

export interface LlmGeneratorPort {
  generateCards(input: GenerateCardsInput): Promise<CardDraft[]>;
}

// Re-exported for callers that imported CardDraft from this module in slice 1.
export type { CardDraft };
