import { describe, test, expect } from "bun:test";
import { estimateCostUsd, MODEL_PRICING } from "../src/core/domain/llmCost";

describe("estimateCostUsd", () => {
  test("computes cost from a known model's per-million-token pricing", () => {
    const pricing = MODEL_PRICING["anthropic/claude-3.5-haiku"]!;
    const cost = estimateCostUsd("anthropic/claude-3.5-haiku", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(pricing.promptPerMillionUsd + pricing.completionPerMillionUsd, 6);
  });

  test("scales linearly with token counts", () => {
    const full = estimateCostUsd("anthropic/claude-3.5-haiku", 1_000_000, 0);
    const half = estimateCostUsd("anthropic/claude-3.5-haiku", 500_000, 0);
    expect(half).toBeCloseTo(full / 2, 6);
  });

  test("falls back to a non-zero estimate for an unknown model id", () => {
    const cost = estimateCostUsd("some/unknown-model-id", 1000, 1000);
    expect(cost).toBeGreaterThan(0);
  });

  test("returns 0 for zero tokens", () => {
    expect(estimateCostUsd("anthropic/claude-3.5-haiku", 0, 0)).toBe(0);
  });
});
