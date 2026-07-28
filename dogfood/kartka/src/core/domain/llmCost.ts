// Static per-model $/million-token pricing used to compute estimatedCostUsd
// for every llm_call_log row (slice 2). Hand-maintained rather than fetched
// from OpenRouter's /api/v1/models at call time, so a cost estimate is always
// available even if that endpoint is slow/unreachable. Update this table when
// OPENROUTER_MODEL's default (or a commonly-used override) changes price.
export interface ModelPricing {
  promptPerMillionUsd: number;
  completionPerMillionUsd: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "anthropic/claude-3.5-haiku": { promptPerMillionUsd: 0.8, completionPerMillionUsd: 4 },
  "anthropic/claude-3.7-sonnet": { promptPerMillionUsd: 3, completionPerMillionUsd: 15 },
  "openai/gpt-4o-mini": { promptPerMillionUsd: 0.15, completionPerMillionUsd: 0.6 },
  "google/gemini-2.0-flash-001": { promptPerMillionUsd: 0.1, completionPerMillionUsd: 0.4 },
  "meta-llama/llama-3.3-70b-instruct": { promptPerMillionUsd: 0.12, completionPerMillionUsd: 0.3 },
};

/** Used for any model id not present in MODEL_PRICING, so a real (if rough) number is always stored. */
const FALLBACK_PRICING: ModelPricing = { promptPerMillionUsd: 1, completionPerMillionUsd: 3 };

/** Estimates USD cost for one LLM call from its token usage. Pure function — unit-tested directly. */
export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? FALLBACK_PRICING;
  const cost =
    (promptTokens / 1_000_000) * pricing.promptPerMillionUsd +
    (completionTokens / 1_000_000) * pricing.completionPerMillionUsd;
  // Round to 6 decimal places (fractions of a cent) so tiny calls don't collapse to 0.
  return Math.round(cost * 1e6) / 1e6;
}
