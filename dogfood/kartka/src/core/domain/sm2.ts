// SuperMemo-2 (SM-2) spaced repetition algorithm. Pure function, no side effects,
// no framework/adapter imports — see docs/architecture.md for the hexagonal rule.

import type { ReviewQuality } from "./types";

export interface Sm2Input {
  easiness: number;
  interval: number;
  repetitions: number;
  quality: ReviewQuality;
}

export interface Sm2Result {
  easiness: number;
  interval: number;
  repetitions: number;
}

const MIN_EASINESS = 1.3;
const DEFAULT_EASINESS = 2.5;

/**
 * Classic SuperMemo-2 update step.
 *
 * - quality < 3 ("fail"): repetitions resets to 0, interval resets to 1 day.
 * - quality >= 3 ("pass"): repetitions increments; interval grows via the
 *   1 / 6 / interval*easiness schedule.
 * - easiness is nudged by a formula that rewards quality=5 and punishes
 *   quality=0, floored at 1.3 so a card never becomes "impossible" to space out.
 */
export function sm2(input: Sm2Input): Sm2Result {
  const { quality } = input;
  let { easiness, interval, repetitions } = input;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
  }

  easiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easiness < MIN_EASINESS) easiness = MIN_EASINESS;

  return { easiness, interval, repetitions };
}

/** Convenience: default starting state for a card a user has never reviewed. */
export function sm2InitialState(): { easiness: number; interval: number; repetitions: number } {
  return { easiness: DEFAULT_EASINESS, interval: 0, repetitions: 0 };
}

/** Adds `days` (may be fractional) to `from`, returning a new Date. */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
