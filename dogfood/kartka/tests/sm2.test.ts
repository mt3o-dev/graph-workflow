import { describe, test, expect } from "bun:test";
import { sm2, sm2InitialState, addDays } from "../src/core/domain/sm2";

describe("sm2", () => {
  test("quality=5 sequence grows interval per the SM-2 schedule", () => {
    let state = sm2InitialState();
    // 1st review
    state = sm2({ ...state, quality: 5 });
    expect(state.repetitions).toBe(1);
    expect(state.interval).toBe(1);
    // 2nd review
    state = sm2({ ...state, quality: 5 });
    expect(state.repetitions).toBe(2);
    expect(state.interval).toBe(6);
    // 3rd review: interval = round(6 * easiness)
    const easinessBefore3rd = state.easiness;
    state = sm2({ ...state, quality: 5 });
    expect(state.repetitions).toBe(3);
    expect(state.interval).toBe(Math.round(6 * easinessBefore3rd));
    // easiness should have grown (quality=5 always increases it, until it plateaus near the cap)
    expect(state.easiness).toBeGreaterThan(2.5);
  });

  test("quality=3 sequence still advances repetitions/interval but shrinks easiness", () => {
    let state = sm2InitialState();
    state = sm2({ ...state, quality: 3 });
    expect(state.repetitions).toBe(1);
    expect(state.interval).toBe(1);
    expect(state.easiness).toBeLessThan(2.5); // quality=3 nudges easiness down

    state = sm2({ ...state, quality: 3 });
    expect(state.repetitions).toBe(2);
    expect(state.interval).toBe(6);

    state = sm2({ ...state, quality: 3 });
    expect(state.repetitions).toBe(3);
    expect(state.interval).toBeGreaterThanOrEqual(6); // round(6 * easiness), easiness < 2.5 but > 1
  });

  test("quality=0 resets repetitions and interval regardless of prior streak", () => {
    let state = sm2InitialState();
    state = sm2({ ...state, quality: 5 });
    state = sm2({ ...state, quality: 5 });
    state = sm2({ ...state, quality: 5 }); // built up a streak

    const failed = sm2({ ...state, quality: 0 });
    expect(failed.repetitions).toBe(0);
    expect(failed.interval).toBe(1);
  });

  test("easiness never drops below the 1.3 floor even under repeated failure", () => {
    let state = sm2InitialState();
    for (let i = 0; i < 50; i++) {
      state = sm2({ ...state, quality: 0 });
    }
    expect(state.easiness).toBeGreaterThanOrEqual(1.3);
    expect(state.easiness).toBeCloseTo(1.3, 5);
  });

  test("quality=1 and quality=2 (still failing) both reset the streak", () => {
    const base = { easiness: 2.5, interval: 6, repetitions: 3 } as const;
    const q1 = sm2({ ...base, quality: 1 });
    const q2 = sm2({ ...base, quality: 2 });
    expect(q1.repetitions).toBe(0);
    expect(q1.interval).toBe(1);
    expect(q2.repetitions).toBe(0);
    expect(q2.interval).toBe(1);
  });
});

describe("addDays", () => {
  test("adds whole days in milliseconds", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const result = addDays(start, 6);
    expect(result.toISOString()).toBe("2026-01-07T00:00:00.000Z");
  });
});
