import type { LlmGeneratorPort, GenerateCardsInput } from "../../core/ports/llmGeneratorPort";
import type { LlmCallLogRepoPort } from "../../core/ports/llmCallLogRepoPort";
import type { CardDraft } from "../../core/domain/types";
import { extractJsonPayload, draftsFromLlmPayload, validateDrafts } from "../../core/domain/llmResponseParsing";
import { estimateCostUsd } from "../../core/domain/llmCost";
import { logLlmCall } from "../../core/usecases/llmUsecases";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_COUNT = 8;

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  /** Overridable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

function buildPrompt(sourceText: string, count: number): string {
  return [
    "You help a student turn source material into spaced-repetition flashcards.",
    `Propose about ${count} cards (fewer if the material is too short to support that many).`,
    "Distribute cards across these types where the material actually supports them — do not force every type:",
    '- "basic": most common. payload: {"front": string, "back": string}',
    '- "cloze": second most common. payload: {"text": string} containing at least one {{c1::hidden text}} deletion',
    '- "multiple_choice": payload: {"question": string, "options": string[] (>=2), "correctIndex": number}',
    '- "true_false": payload: {"statement": string, "isTrue": boolean}',
    '- "type_answer": payload: {"prompt": string, "acceptedAnswers": string[]}',
    '- "image_occlusion": NEVER use this type — no image was provided with this request.',
    "",
    "Respond with ONLY a JSON object of the exact shape:",
    '{"drafts": [{"type": "basic"|"cloze"|"multiple_choice"|"true_false"|"type_answer", "payload": {...}, "confidence": 0-1, "rationale": "short reason this card is useful"}]}',
    "No prose outside the JSON.",
    "",
    "Source material:",
    '"""',
    sourceText,
    '"""',
  ].join("\n");
}

/**
 * Implements LlmGeneratorPort against OpenRouter's chat completions API.
 * Every call — success or failure — is logged via logLlmCall (llm_call_log
 * table), and a malformed model response is defensively parsed/validated
 * rather than allowed to throw past this function as drafts.
 */
export function createOpenRouterAdapter(config: OpenRouterConfig, llmCallLogRepo: LlmCallLogRepoPort): LlmGeneratorPort {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async generateCards(input: GenerateCardsInput): Promise<CardDraft[]> {
      const count = input.count ?? DEFAULT_COUNT;
      const prompt = buildPrompt(input.sourceText, count);

      let res: Response;
      try {
        res = await fetchImpl(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
            // Recommended by OpenRouter for attribution; harmless if ignored.
            "HTTP-Referer": "https://kartka.local",
            "X-Title": "Kartka",
          },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });
      } catch (err) {
        await logLlmCall(llmCallLogRepo, {
          userId: input.userId,
          model: config.model,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          estimatedCostUsd: null,
          status: "error",
          errorMessage: err instanceof Error ? err.message : "Network error calling OpenRouter",
        });
        throw err;
      }

      const body = await res.json().catch(() => null);

      if (!res.ok || !body) {
        const errorMessage =
          (body as { error?: { message?: string } } | null)?.error?.message ?? `OpenRouter HTTP ${res.status}`;
        await logLlmCall(llmCallLogRepo, {
          userId: input.userId,
          model: config.model,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          estimatedCostUsd: null,
          status: "error",
          errorMessage,
        });
        throw new Error(errorMessage);
      }

      const usage = (body as { usage?: Record<string, number> }).usage ?? {};
      const promptTokens = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : null;
      const completionTokens = typeof usage.completion_tokens === "number" ? usage.completion_tokens : null;
      const totalTokens =
        typeof usage.total_tokens === "number"
          ? usage.total_tokens
          : promptTokens != null && completionTokens != null
            ? promptTokens + completionTokens
            : null;
      const estimatedCostUsd =
        promptTokens != null && completionTokens != null ? estimateCostUsd(config.model, promptTokens, completionTokens) : null;

      const content = (body as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? "";

      let drafts: CardDraft[] = [];
      try {
        const payload = extractJsonPayload(content);
        drafts = validateDrafts(draftsFromLlmPayload(payload));
      } catch {
        // Malformed/garbage LLM output — treat as zero drafts, not a crash.
        drafts = [];
      }

      // The HTTP call succeeded even if the model's JSON was garbage; that
      // distinction (empty drafts vs. a real API error) is what status tracks.
      await logLlmCall(llmCallLogRepo, {
        userId: input.userId,
        model: config.model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
        status: "success",
        errorMessage: null,
      });

      return drafts;
    },
  };
}
