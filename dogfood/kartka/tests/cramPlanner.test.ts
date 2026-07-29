import { describe, test, expect } from "bun:test";
import { planCramSession, DEFAULT_SESSION_CAP, DEFAULT_PACE_PER_DAY, type CramCardInput } from "../src/core/domain/cramPlanner";
import type { ReviewState, FsrsReviewState } from "../src/core/domain/types";

const NOW = new Date("2026-08-01T00:00:00Z");

function sm2State(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    cardId: "c",
    userId: "u",
    easiness: 2.5,
    interval: 10,
    repetitions: 3,
    dueAt: new Date("2026-08-10T00:00:00Z"),
    lastReviewedAt: new Date("2026-07-31T00:00:00Z"),
    ...overrides,
  };
}

function fsrsState(overrides: Partial<FsrsReviewState> = {}): FsrsReviewState {
  return {
    cardId: "c",
    userId: "u",
    difficulty: 5,
    stability: 10,
    reps: 3,
    dueAt: new Date("2026-08-10T00:00:00Z"),
    lastReviewedAt: new Date("2026-07-31T00:00:00Z"),
    ...overrides,
  };
}

describe("cramPlanner: no exam date", () => {
  test("returns inactive/empty output regardless of card count", () => {
    const cards: CramCardInput[] = Array.from({ length: 20 }, (_, i) => ({ cardId: `card-${i}`, state: null }));
    const result = planCramSession({ cards, examDate: null, now: NOW });
    expect(result.active).toBe(false);
    expect(result.daysUntilExam).toBeNull();
    expect(result.selected).toEqual([]);
    expect(result.deprioritized).toEqual([]);
  });
});

describe("cramPlanner: exam far away + small set", () => {
  test("normal-ish selection: everything fits, nothing deprioritized", () => {
    const examDate = new Date("2026-12-01T00:00:00Z"); // ~120 days out
    const cards: CramCardInput[] = [
      { cardId: "never-1", state: null },
      { cardId: "never-2", state: null },
      { cardId: "weak-1", state: sm2State({ cardId: "weak-1", easiness: 1.4 }) },
      { cardId: "strong-1", state: sm2State({ cardId: "strong-1", easiness: 2.9, dueAt: new Date("2026-11-01T00:00:00Z") }) },
    ];
    const result = planCramSession({ cards, examDate, now: NOW });
    expect(result.active).toBe(true);
    expect(result.deprioritized).toEqual([]);
    // never-reviewed cards should be selected first
    expect(result.selected.slice(0, 2).sort()).toEqual(["never-1", "never-2"]);
    expect(result.selected).toContain("weak-1");
    expect(result.selected).toContain("strong-1");
  });
});

describe("cramPlanner: exam very close + large set", () => {
  test("aggressive prioritization: not everything fits, deprioritized list is non-empty", () => {
    const examDate = new Date("2026-08-02T00:00:00Z"); // 1 day out
    const cards: CramCardInput[] = Array.from({ length: 100 }, (_, i) => ({
      cardId: `card-${String(i).padStart(3, "0")}`,
      state: i % 3 === 0 ? null : sm2State({ cardId: `card-${i}`, easiness: 1.5 + (i % 5) * 0.1 }),
    }));
    const result = planCramSession({ cards, examDate, now: NOW });
    expect(result.active).toBe(true);
    expect(result.daysUntilExam).toBe(1);
    expect(result.deprioritized.length).toBeGreaterThan(0);
    // capacity for 1 day is DEFAULT_PACE_PER_DAY
    const capacity = DEFAULT_PACE_PER_DAY;
    expect(result.deprioritized.length).toBe(100 - capacity);
    expect(result.selected.length).toBeLessThanOrEqual(DEFAULT_SESSION_CAP);
  });
});

describe("cramPlanner: mastery ranking", () => {
  test("already-mastered cards rank lower than never-reviewed/weak cards", () => {
    const examDate = new Date("2026-08-20T00:00:00Z");
    const mastered = sm2State({ cardId: "mastered", easiness: 3.0, dueAt: new Date("2026-08-10T00:00:00Z") });
    const cards: CramCardInput[] = [
      { cardId: "mastered", state: mastered },
      { cardId: "never", state: null },
      { cardId: "weak", state: sm2State({ cardId: "weak", easiness: 1.3 }) },
    ];
    const result = planCramSession({ cards, examDate, now: NOW });
    const order = result.selected;
    expect(order.indexOf("never")).toBeLessThan(order.indexOf("mastered"));
    expect(order.indexOf("weak")).toBeLessThan(order.indexOf("mastered"));
    // mastered card isn't in the "needs attention" pool, so it never appears in deprioritized
    expect(result.deprioritized).not.toContain("mastered");
  });

  test("a card due at/after the exam date is treated as needing attention even if otherwise strong", () => {
    const examDate = new Date("2026-08-05T00:00:00Z");
    const cards: CramCardInput[] = [
      { cardId: "late-but-strong", state: sm2State({ cardId: "late-but-strong", easiness: 2.9, dueAt: new Date("2026-08-06T00:00:00Z") }) },
      { cardId: "on-time-strong", state: sm2State({ cardId: "on-time-strong", easiness: 2.9, dueAt: new Date("2026-08-02T00:00:00Z") }) },
    ];
    const result = planCramSession({ cards, examDate, now: NOW });
    expect(result.selected.indexOf("late-but-strong")).toBeLessThan(result.selected.indexOf("on-time-strong"));
  });
});

describe("cramPlanner: FSRS states", () => {
  test("works with FsrsReviewState (stability-based strength) just like SM-2", () => {
    const examDate = new Date("2026-08-10T00:00:00Z");
    const cards: CramCardInput[] = [
      { cardId: "never", state: null },
      { cardId: "low-stability", state: fsrsState({ cardId: "low-stability", stability: 1 }) },
      { cardId: "high-stability", state: fsrsState({ cardId: "high-stability", stability: 55, dueAt: new Date("2026-09-01T00:00:00Z") }) },
    ];
    const result = planCramSession({ cards, examDate, now: NOW });
    expect(result.selected.indexOf("never")).toBeLessThan(result.selected.indexOf("low-stability"));
    expect(result.selected.indexOf("low-stability")).toBeLessThan(result.selected.indexOf("high-stability"));
  });
});

describe("cramPlanner: determinism", () => {
  test("same inputs always produce the same output (no randomness)", () => {
    const examDate = new Date("2026-08-15T00:00:00Z");
    const cards: CramCardInput[] = Array.from({ length: 30 }, (_, i) => ({
      cardId: `c-${i}`,
      state: i % 2 === 0 ? null : sm2State({ cardId: `c-${i}`, easiness: 1.3 + (i % 7) * 0.2 }),
    }));
    const a = planCramSession({ cards, examDate, now: NOW });
    const b = planCramSession({ cards, examDate, now: NOW });
    expect(a).toEqual(b);
  });

  test("sessionCap and pacePerDay overrides are respected", () => {
    const examDate = new Date("2026-08-31T00:00:00Z");
    const cards: CramCardInput[] = Array.from({ length: 50 }, (_, i) => ({ cardId: `c-${i}`, state: null }));
    const result = planCramSession({ cards, examDate, now: NOW, sessionCap: 5, pacePerDay: 2 });
    expect(result.selected.length).toBe(5);
    // 30 days * pace 2/day = 60 capacity, more than 50 needing-attention cards, so nothing deprioritized
    expect(result.deprioritized).toEqual([]);
  });
});
