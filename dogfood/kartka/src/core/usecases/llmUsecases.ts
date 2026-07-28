import type { LlmGeneratorPort } from "../ports/llmGeneratorPort";
import type { LlmCallLogRepoPort, LogLlmCallInput } from "../ports/llmCallLogRepoPort";
import type { SetRepoPort } from "../ports/setRepoPort";
import type { CardDraft, LlmCallLog } from "../domain/types";
import { ValidationError } from "../domain/errors";
import { getOwnedSet } from "./setUsecases";

/** Thin wrapper the OpenRouter adapter calls after every request (success or failure) — see docs/architecture.md. */
export async function logLlmCall(repo: LlmCallLogRepoPort, input: LogLlmCallInput): Promise<LlmCallLog> {
  return repo.logCall(input);
}

export interface GenerateCardDraftsInput {
  setId: string;
  ownerId: string;
  sourceText: string;
  count?: number;
}

/**
 * Ownership-checked entry point for slice 2's "AI-assisted cards" flow. Enforces
 * that the requester owns the target set *before* ever calling the LLM (the
 * ownership-bug class flagged in slice 1's review — see roadmap.md — must not
 * repeat here). Returns validated drafts only; nothing is persisted.
 */
export async function generateCardDrafts(
  llmGenerator: LlmGeneratorPort,
  setRepo: SetRepoPort,
  input: GenerateCardDraftsInput,
): Promise<CardDraft[]> {
  await getOwnedSet(setRepo, input.setId, input.ownerId);

  const sourceText = input.sourceText.trim();
  if (sourceText.length === 0) throw new ValidationError("Source text is required");

  return llmGenerator.generateCards({
    sourceText,
    setId: input.setId,
    userId: input.ownerId,
    count: input.count,
  });
}
