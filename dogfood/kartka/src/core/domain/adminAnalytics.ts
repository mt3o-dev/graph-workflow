// Pure aggregation over already-logged llm_call_log rows (slice 2's data
// source). No DB access here — the admin analytics usecase (adminUsecases.ts)
// fetches the rows via LlmCallLogRepoPort.listAll() and hands them to this
// function, which is unit-testable with plain fake/seeded arrays (see
// tests/adminUsecases.test.ts).
import type { LlmCallLog } from "./types";

export interface LlmCostTotals {
  callCount: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface LlmCostByModel extends LlmCostTotals {
  model: string;
}

export interface LlmCostByDay extends LlmCostTotals {
  /** YYYY-MM-DD, UTC. */
  day: string;
}

export interface LlmCostAggregation {
  totals: LlmCostTotals;
  /** Sorted by totalCostUsd descending (most expensive model first). */
  byModel: LlmCostByModel[];
  /** Sorted by day ascending. */
  byDay: LlmCostByDay[];
}

function round6(n: number): number {
  // Round to 6 decimal places (fractions of a cent) — mirrors llmCost.ts's
  // estimateCostUsd rounding so aggregated totals don't drift from the sum
  // of already-rounded per-call figures.
  return Math.round(n * 1e6) / 1e6;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Aggregates raw llm_call_log rows into totals + per-model + per-day breakdowns. Pure function. */
export function aggregateLlmCosts(logs: LlmCallLog[]): LlmCostAggregation {
  const totals: LlmCostTotals = { callCount: 0, totalTokens: 0, totalCostUsd: 0 };
  const byModelMap = new Map<string, LlmCostTotals>();
  const byDayMap = new Map<string, LlmCostTotals>();

  for (const log of logs) {
    const tokens = log.totalTokens ?? 0;
    const cost = log.estimatedCostUsd ?? 0;

    totals.callCount += 1;
    totals.totalTokens += tokens;
    totals.totalCostUsd += cost;

    const modelBucket = byModelMap.get(log.model) ?? { callCount: 0, totalTokens: 0, totalCostUsd: 0 };
    modelBucket.callCount += 1;
    modelBucket.totalTokens += tokens;
    modelBucket.totalCostUsd += cost;
    byModelMap.set(log.model, modelBucket);

    const day = dayKey(log.requestedAt);
    const dayBucket = byDayMap.get(day) ?? { callCount: 0, totalTokens: 0, totalCostUsd: 0 };
    dayBucket.callCount += 1;
    dayBucket.totalTokens += tokens;
    dayBucket.totalCostUsd += cost;
    byDayMap.set(day, dayBucket);
  }

  totals.totalCostUsd = round6(totals.totalCostUsd);

  const byModel = [...byModelMap.entries()]
    .map(([model, v]) => ({ model, ...v, totalCostUsd: round6(v.totalCostUsd) }))
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd);

  const byDay = [...byDayMap.entries()]
    .map(([day, v]) => ({ day, ...v, totalCostUsd: round6(v.totalCostUsd) }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return { totals, byModel, byDay };
}
