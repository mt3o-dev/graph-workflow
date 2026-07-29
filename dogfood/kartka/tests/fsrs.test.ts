import { describe, test, expect } from "bun:test";
import {
  fsrs,
  fsrsInitialState,
  fsrsGradeFromQuality,
  bootstrapFsrsFromSm2,
  FSRS_DEFAULT_WEIGHTS,
  DEFAULT_DESIRED_RETENTION,
  type FsrsGrade,
} from "../src/core/domain/fsrs";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAfter(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

describe("fsrsGradeFromQuality", () => {
  test("maps the shared 0-5 ReviewQuality scale onto FSRS's Again/Hard/Good/Easy", () => {
    expect(fsrsGradeFromQuality(0)).toBe(1); // Again
    expect(fsrsGradeFromQuality(1)).toBe(1); // Again (SELF_RATING.again)
    expect(fsrsGradeFromQuality(2)).toBe(2); // Hard (SELF_RATING.hard)
    expect(fsrsGradeFromQuality(3)).toBe(3); // Good
    expect(fsrsGradeFromQuality(4)).toBe(3); // Good (SELF_RATING.good / AUTO_CORRECT)
    expect(fsrsGradeFromQuality(5)).toBe(4); // Easy (SELF_RATING.easy)
  });
});

describe("fsrs: first review of a brand-new card", () => {
  test("bootstraps difficulty/stability from the S0/D0 tables per grade, ignoring input.difficulty/stability", () => {
    const init = fsrsInitialState();
    for (const grade of [1, 2, 3, 4] as FsrsGrade[]) {
      const result = fsrs({
        difficulty: 999, // garbage — must be ignored since reps=0
        stability: 999,
        reps: init.reps,
        lastReviewedAt: null,
        grade,
        now: new Date("2026-01-01T00:00:00Z"),
      });
      expect(result.stability).toBeCloseTo(FSRS_DEFAULT_WEIGHTS[grade - 1]!, 6);
      expect(result.reps).toBe(1);
      expect(result.difficulty).toBeGreaterThanOrEqual(1);
      expect(result.difficulty).toBeLessThanOrEqual(10);
      expect(result.intervalDays).toBeGreaterThanOrEqual(1);
    }
  });

  test("a first-review Again (grade 1) still produces a valid >=1 day interval, never a negative/zero one", () => {
    const result = fsrs({
      difficulty: 0,
      stability: 0,
      reps: 0,
      lastReviewedAt: null,
      grade: 1,
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(result.intervalDays).toBeGreaterThanOrEqual(1);
    expect(result.stability).toBeGreaterThan(0);
  });

  test("higher first-review grades produce longer or equal first intervals (Easy schedules further out than Again)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const again = fsrs({ difficulty: 0, stability: 0, reps: 0, lastReviewedAt: null, grade: 1, now });
    const hard = fsrs({ difficulty: 0, stability: 0, reps: 0, lastReviewedAt: null, grade: 2, now });
    const good = fsrs({ difficulty: 0, stability: 0, reps: 0, lastReviewedAt: null, grade: 3, now });
    const easy = fsrs({ difficulty: 0, stability: 0, reps: 0, lastReviewedAt: null, grade: 4, now });

    expect(again.intervalDays).toBeLessThanOrEqual(hard.intervalDays);
    expect(hard.intervalDays).toBeLessThanOrEqual(good.intervalDays);
    expect(good.intervalDays).toBeLessThanOrEqual(easy.intervalDays);
  });
});

describe("fsrs: repeated Good/Easy grades grow stability over successive reviews", () => {
  test("stability increases monotonically across a run of consecutive Good grades", () => {
    let now = new Date("2026-01-01T00:00:00Z");
    let state = fsrs({ difficulty: 0, stability: 0, reps: 0, lastReviewedAt: null, grade: 3, now });
    let lastReviewedAt = now;

    const stabilities = [state.stability];
    for (let i = 0; i < 6; i++) {
      now = daysAfter(now, state.intervalDays);
      state = fsrs({
        difficulty: state.difficulty,
        stability: state.stability,
        reps: state.reps,
        lastReviewedAt,
        grade: 3,
        now,
      });
      lastReviewedAt = now;
      stabilities.push(state.stability);
    }

    for (let i = 1; i < stabilities.length; i++) {
      expect(stabilities[i]!).toBeGreaterThan(stabilities[i - 1]!);
    }
    // Reps tracks the number of fsrs() calls made (one bootstrap + 6 follow-ups).
    expect(state.reps).toBe(7);
  });

  test("Easy grows stability faster than Good from the same starting point (Easy bonus weight w16 > 1)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const lastReviewedAt = new Date("2025-12-25T00:00:00Z"); // 7 days elapsed
    const baseDifficulty = 5;
    const baseStability = 4;

    const good = fsrs({ difficulty: baseDifficulty, stability: baseStability, reps: 2, lastReviewedAt, grade: 3, now });
    const easy = fsrs({ difficulty: baseDifficulty, stability: baseStability, reps: 2, lastReviewedAt, grade: 4, now });

    expect(easy.stability).toBeGreaterThan(good.stability);
  });
});

describe("fsrs: an Again (grade 1) resets/shrinks stability relative to a successful review", () => {
  test("failing a well-established card (high stability) drops stability sharply compared to passing it", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const lastReviewedAt = new Date("2026-01-01T00:00:00Z"); // 9 days elapsed
    const established = { difficulty: 4, stability: 30, reps: 5, lastReviewedAt };

    const failed = fsrs({ ...established, grade: 1, now });
    const passed = fsrs({ ...established, grade: 3, now });

    expect(failed.stability).toBeLessThan(established.stability);
    expect(failed.stability).toBeLessThan(passed.stability);
    expect(failed.intervalDays).toBeLessThan(passed.intervalDays);
  });

  test("difficulty rises after an Again and falls after an Easy, from the same starting difficulty", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const lastReviewedAt = new Date("2026-01-05T00:00:00Z");
    const base = { difficulty: 5, stability: 8, reps: 3, lastReviewedAt };

    const again = fsrs({ ...base, grade: 1, now });
    const easy = fsrs({ ...base, grade: 4, now });

    expect(again.difficulty).toBeGreaterThan(base.difficulty);
    expect(easy.difficulty).toBeLessThan(base.difficulty);
  });
});

describe("fsrs: difficulty saturates at its documented [1,10] bounds", () => {
  test("repeated Again grades push difficulty up to, but never past, 10", () => {
    let now = new Date("2026-01-01T00:00:00Z");
    let state = fsrs({ difficulty: 0, stability: 0, reps: 0, lastReviewedAt: null, grade: 1, now });
    let lastReviewedAt = now;

    for (let i = 0; i < 100; i++) {
      now = daysAfter(now, Math.max(state.intervalDays, 1));
      state = fsrs({ difficulty: state.difficulty, stability: state.stability, reps: state.reps, lastReviewedAt, grade: 1, now });
      lastReviewedAt = now;
      expect(state.difficulty).toBeLessThanOrEqual(10);
      expect(state.difficulty).toBeGreaterThanOrEqual(1);
    }
    expect(state.difficulty).toBeGreaterThan(9); // should have climbed close to the ceiling
  });

  test("repeated Easy grades push difficulty down to, but never past, 1", () => {
    let now = new Date("2026-01-01T00:00:00Z");
    let state = fsrs({ difficulty: 0, stability: 0, reps: 0, lastReviewedAt: null, grade: 4, now });
    let lastReviewedAt = now;

    for (let i = 0; i < 100; i++) {
      now = daysAfter(now, Math.max(state.intervalDays, 1));
      state = fsrs({ difficulty: state.difficulty, stability: state.stability, reps: state.reps, lastReviewedAt, grade: 4, now });
      lastReviewedAt = now;
      expect(state.difficulty).toBeGreaterThanOrEqual(1);
      expect(state.difficulty).toBeLessThanOrEqual(10);
    }
    expect(state.difficulty).toBeLessThan(2); // should have dropped close to the floor
  });

  test("clamps an already out-of-range input difficulty back into [1,10] via nextDifficulty's mean reversion", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    const lastReviewedAt = new Date("2026-01-01T00:00:00Z");
    const result = fsrs({ difficulty: 999, stability: 5, reps: 3, lastReviewedAt, grade: 3, now });
    expect(result.difficulty).toBeLessThanOrEqual(10);
    expect(result.difficulty).toBeGreaterThanOrEqual(1);
  });
});

describe("fsrs: interval responds to desiredRetention", () => {
  test("a lower desired retention produces a longer interval for the same stability", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const highRetention = fsrs({ difficulty: 0, stability: 0, reps: 0, lastReviewedAt: null, grade: 3, now, desiredRetention: 0.95 });
    const lowRetention = fsrs({ difficulty: 0, stability: 0, reps: 0, lastReviewedAt: null, grade: 3, now, desiredRetention: 0.8 });
    expect(lowRetention.intervalDays).toBeGreaterThan(highRetention.intervalDays);
  });

  test("defaults to DEFAULT_DESIRED_RETENTION (0.9) when none is passed", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const implicit = fsrs({ difficulty: 0, stability: 0, reps: 0, lastReviewedAt: null, grade: 3, now });
    const explicit = fsrs({ difficulty: 0, stability: 0, reps: 0, lastReviewedAt: null, grade: 3, now, desiredRetention: DEFAULT_DESIRED_RETENTION });
    expect(implicit.intervalDays).toBe(explicit.intervalDays);
  });
});

describe("bootstrapFsrsFromSm2: migrating an existing SM-2 card to FSRS without resetting progress", () => {
  test("uses the SM-2 interval as the starting stability when interval > 0", () => {
    const result = bootstrapFsrsFromSm2({ easiness: 2.5, interval: 12, repetitions: 3 });
    expect(result.stability).toBe(12);
    expect(result.reps).toBe(3);
  });

  test("falls back to FSRS's own Good-grade S0 default when interval is 0 (no real elapsed-days signal yet)", () => {
    const result = bootstrapFsrsFromSm2({ easiness: 2.5, interval: 0, repetitions: 0 });
    expect(result.stability).toBeCloseTo(FSRS_DEFAULT_WEIGHTS[2]!, 6); // w[2] = S0(Good)
  });

  test("reps carries over as at least 1, so the caller's next fsrs() call takes the existing-card path, not the fresh-card bootstrap", () => {
    const neverSucceeded = bootstrapFsrsFromSm2({ easiness: 1.3, interval: 0, repetitions: 0 });
    expect(neverSucceeded.reps).toBeGreaterThanOrEqual(1);

    const established = bootstrapFsrsFromSm2({ easiness: 2.5, interval: 6, repetitions: 2 });
    expect(established.reps).toBe(2);
  });

  test("difficulty is the inverse of easiness: low easiness (hard card) maps to high difficulty, and vice versa", () => {
    const hardCard = bootstrapFsrsFromSm2({ easiness: 1.3, interval: 5, repetitions: 2 }); // SM-2's floor
    const easyCard = bootstrapFsrsFromSm2({ easiness: 3.0, interval: 5, repetitions: 2 }); // assumed ceiling
    expect(hardCard.difficulty).toBeGreaterThan(easyCard.difficulty);
    expect(hardCard.difficulty).toBeCloseTo(10, 5);
    expect(easyCard.difficulty).toBeCloseTo(1, 5);
  });

  test("difficulty is always clamped into [1,10] even for an easiness above the assumed ceiling", () => {
    const wayAboveCeiling = bootstrapFsrsFromSm2({ easiness: 10, interval: 5, repetitions: 2 });
    expect(wayAboveCeiling.difficulty).toBeGreaterThanOrEqual(1);
    expect(wayAboveCeiling.difficulty).toBeCloseTo(1, 5);
  });

  test("a bootstrapped state, fed back through fsrs(), produces a sane next interval rather than an immediate re-due card", () => {
    const sm2State = { easiness: 2.3, interval: 20, repetitions: 4 };
    const bootstrapped = bootstrapFsrsFromSm2(sm2State);
    const lastReviewedAt = new Date("2026-01-01T00:00:00Z");
    const now = daysAfter(lastReviewedAt, 15); // reviewed partway through the bootstrapped stability window

    const result = fsrs({
      difficulty: bootstrapped.difficulty,
      stability: bootstrapped.stability,
      reps: bootstrapped.reps,
      lastReviewedAt,
      grade: 3, // Good
      now,
    });

    expect(result.intervalDays).toBeGreaterThan(0);
    // A successful review of an already-decently-stable bootstrapped card
    // should grow (or at least not collapse) its stability, not reset it.
    expect(result.stability).toBeGreaterThan(0);
  });
});
