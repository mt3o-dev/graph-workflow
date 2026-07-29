import { describe, test, expect } from "bun:test";
import { aggregateLlmCosts } from "../src/core/domain/adminAnalytics";
import type { LlmCallLog } from "../src/core/domain/types";

// Fake/seeded rows — no DB, no OpenRouter calls. Mirrors the shape
// llmCallLogRepo.listAll() would return.
function fakeLog(overrides: Partial<LlmCallLog>): LlmCallLog {
  return {
    id: crypto.randomUUID(),
    userId: "u1",
    requestedAt: new Date("2026-01-01T12:00:00Z"),
    model: "anthropic/claude-3.5-haiku",
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    estimatedCostUsd: 0.0006,
    status: "success",
    errorMessage: null,
    ...overrides,
  };
}

describe("aggregateLlmCosts (pure function, fake/seeded data)", () => {
  test("empty input produces zeroed totals and empty breakdowns", () => {
    const result = aggregateLlmCosts([]);
    expect(result.totals).toEqual({ callCount: 0, totalTokens: 0, totalCostUsd: 0 });
    expect(result.byModel).toEqual([]);
    expect(result.byDay).toEqual([]);
  });

  test("sums totals across all calls, including error rows with null cost/tokens", () => {
    const logs = [
      fakeLog({ totalTokens: 150, estimatedCostUsd: 0.0006 }),
      fakeLog({ totalTokens: 300, estimatedCostUsd: 0.0012 }),
      fakeLog({ status: "error", totalTokens: null, estimatedCostUsd: null, errorMessage: "HTTP 500" }),
    ];

    const result = aggregateLlmCosts(logs);
    expect(result.totals.callCount).toBe(3);
    expect(result.totals.totalTokens).toBe(450);
    expect(result.totals.totalCostUsd).toBeCloseTo(0.0018, 6);
  });

  test("breaks down cost by model, sorted by cost descending", () => {
    const logs = [
      fakeLog({ model: "cheap-model", estimatedCostUsd: 0.0001, totalTokens: 10 }),
      fakeLog({ model: "expensive-model", estimatedCostUsd: 0.05, totalTokens: 1000 }),
      fakeLog({ model: "cheap-model", estimatedCostUsd: 0.0001, totalTokens: 10 }),
    ];

    const result = aggregateLlmCosts(logs);
    expect(result.byModel).toHaveLength(2);
    expect(result.byModel[0]!.model).toBe("expensive-model");
    expect(result.byModel[0]!.callCount).toBe(1);
    expect(result.byModel[1]!.model).toBe("cheap-model");
    expect(result.byModel[1]!.callCount).toBe(2);
    expect(result.byModel[1]!.totalTokens).toBe(20);
  });

  test("breaks down cost by UTC day, sorted ascending, grouping same-day calls", () => {
    const logs = [
      fakeLog({ requestedAt: new Date("2026-01-02T08:00:00Z"), estimatedCostUsd: 0.001 }),
      fakeLog({ requestedAt: new Date("2026-01-01T23:59:00Z"), estimatedCostUsd: 0.002 }),
      fakeLog({ requestedAt: new Date("2026-01-01T00:01:00Z"), estimatedCostUsd: 0.003 }),
    ];

    const result = aggregateLlmCosts(logs);
    expect(result.byDay.map((d) => d.day)).toEqual(["2026-01-01", "2026-01-02"]);
    expect(result.byDay[0]!.callCount).toBe(2);
    expect(result.byDay[0]!.totalCostUsd).toBeCloseTo(0.005, 6);
    expect(result.byDay[1]!.callCount).toBe(1);
  });
});
