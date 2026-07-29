// FSRS (Free Spaced Repetition Scheduler) — pure function, no side effects,
// no framework/adapter imports — see docs/architecture.md for the hexagonal
// rule and sm2.ts for the sibling algorithm this mirrors.
//
// Formulas and default parameter weights follow the publicly documented
// FSRS v4.5 algorithm published by the open-spaced-repetition project:
// https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
// (the "S0/D0" initial-state tables, the D'/S' update formulas for
// success/failure, and the R(t,S) = (1 + t/(9S))^-1 forgetting-curve /
// interval formulas, plus the 17-value w[0..16] default weight vector).
//
// Simplifications vs. the "full" spec:
//  - No per-user parameter optimization. fsrs4anki's optimizer fits w[] to
//    an individual's review history via gradient descent on their own
//    review log; slice 5 hardcodes the published default weights for every
//    FSRS user instead. Per-user fitting is future work — see roadmap.md's
//    slice 5 note, which flags this as a follow-up once there's enough
//    review history to fit against.
//  - No "same-day / short-term" stability model. fsrs4anki adds a separate
//    formula for multiple reviews of the same card within one day; Kartka's
//    review cadence is already day-granular (sm2.ts works the same way), so
//    this is dropped without changing behavior for how the app is actually
//    used.
//  - No interval "fuzz" (randomizing the computed interval by a few percent
//    to spread out review pile-ups) — sm2.ts doesn't fuzz either, so this
//    keeps the two schedulers consistent with each other.

import type { ReviewQuality } from "./types";
import { addDays } from "./sm2";

/** FSRS's own grade vocabulary. 1=Again 2=Hard 3=Good 4=Easy. */
export type FsrsGrade = 1 | 2 | 3 | 4;

/**
 * Maps Kartka's shared 0-5 ReviewQuality scale (see quality.ts) onto FSRS's
 * four-grade vocabulary, so the review UI's existing buttons and outcomes —
 * named after this exact vocabulary already (SELF_RATING in quality.ts:
 * again=1, hard=2, good=4, easy=5; AUTO_CORRECT=4, AUTO_INCORRECT=1) — need
 * no second button set or UI branch for FSRS users:
 *   quality 0-1 -> Again(1), quality 2 -> Hard(2), quality 3-4 -> Good(3),
 *   quality 5 -> Easy(4).
 */
export function fsrsGradeFromQuality(quality: ReviewQuality): FsrsGrade {
  if (quality <= 1) return 1;
  if (quality === 2) return 2;
  if (quality <= 4) return 3;
  return 4;
}

export interface FsrsInput {
  difficulty: number;
  stability: number;
  reps: number;
  lastReviewedAt: Date | null;
  grade: FsrsGrade;
  now: Date;
  /** Desired probability of recall at the next scheduled review, 0 < r < 1. FSRS's published default is 0.9. */
  desiredRetention?: number;
}

export interface FsrsResult {
  difficulty: number;
  stability: number;
  reps: number;
  intervalDays: number;
}

export const DEFAULT_DESIRED_RETENTION = 0.9;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;
const MIN_STABILITY = 0.01;
// Same order-of-magnitude cap most FSRS implementations use so a very easy,
// very stable card doesn't compute an absurd (or overflow-prone) interval.
const MAX_INTERVAL_DAYS = 36_500;

/**
 * FSRS v4.5 default parameter weights (w0-w16), as published by the
 * open-spaced-repetition project (see file header for source). Indexed
 * w[0]..w[16] throughout this file to match the wiki's own notation.
 */
export const FSRS_DEFAULT_WEIGHTS: readonly number[] = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61,
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** S0(G): initial stability for a brand-new card's first review at grade G. */
function initialStability(grade: FsrsGrade, w: readonly number[]): number {
  return w[grade - 1]!;
}

/** D0(G): initial difficulty for a brand-new card's first review at grade G, clamped to [1,10]. */
function initialDifficulty(grade: FsrsGrade, w: readonly number[]): number {
  const d0 = w[4]! - (grade - 3) * w[5]!;
  return clamp(d0, MIN_DIFFICULTY, MAX_DIFFICULTY);
}

/** D': difficulty update after a review at grade G, with mean-reversion toward the "Easy" baseline D0(4). */
function nextDifficulty(prevDifficulty: number, grade: FsrsGrade, w: readonly number[]): number {
  const deltaD = -w[6]! * (grade - 3);
  const dPrime = prevDifficulty + (deltaD * (10 - prevDifficulty)) / 9;
  const meanReversionTarget = w[4]! - w[5]!; // D0(4) — the "Easy" baseline, per the wiki's mean-reversion formula.
  const reverted = w[7]! * meanReversionTarget + (1 - w[7]!) * dPrime;
  return clamp(reverted, MIN_DIFFICULTY, MAX_DIFFICULTY);
}

/** R(t,S): probability of recall after `elapsedDays` at stability S. */
function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/** Stability update on a successful review (grade 2/3/4 — Hard/Good/Easy). */
function nextStabilitySuccess(prevStability: number, prevDifficulty: number, r: number, grade: FsrsGrade, w: readonly number[]): number {
  const hardPenalty = grade === 2 ? w[15]! : 1;
  const easyBonus = grade === 4 ? w[16]! : 1;
  const growth =
    Math.exp(w[8]!) * (11 - prevDifficulty) * Math.pow(prevStability, -w[9]!) * (Math.exp(w[10]! * (1 - r)) - 1) * hardPenalty * easyBonus;
  return prevStability * (1 + growth);
}

/** Stability update on a failed review (grade 1 — Again). */
function nextStabilityFailure(prevStability: number, prevDifficulty: number, r: number, w: readonly number[]): number {
  return w[11]! * Math.pow(prevDifficulty, -w[12]!) * (Math.pow(prevStability + 1, w[13]!) - 1) * Math.exp(w[14]! * (1 - r));
}

/** I(r,S): interval in days to schedule the next review at stability S for desired retention r. */
function intervalFromStability(stability: number, desiredRetention: number): number {
  const days = 9 * stability * (1 / desiredRetention - 1);
  return clamp(Math.round(days), 1, MAX_INTERVAL_DAYS);
}

/**
 * FSRS update step, mirroring sm2()'s shape: pure state-in / state-out, no
 * I/O. A card with `reps === 0` (or no `lastReviewedAt`) is treated as
 * brand-new and bootstrapped from the S0/D0 tables for the given grade —
 * `difficulty`/`stability` on the input are ignored in that case. Otherwise
 * the existing difficulty/stability are updated via the success or failure
 * formula, using the retrievability computed from the elapsed time since
 * `lastReviewedAt`.
 */
export function fsrs(input: FsrsInput): FsrsResult {
  const w = FSRS_DEFAULT_WEIGHTS;
  const desiredRetention = input.desiredRetention ?? DEFAULT_DESIRED_RETENTION;
  const { grade } = input;

  let difficulty: number;
  let stability: number;

  if (input.reps <= 0 || input.lastReviewedAt === null) {
    difficulty = initialDifficulty(grade, w);
    stability = initialStability(grade, w);
  } else {
    const elapsedDays = Math.max(0, (input.now.getTime() - input.lastReviewedAt.getTime()) / 86_400_000);
    const r = retrievability(elapsedDays, input.stability);

    difficulty = nextDifficulty(input.difficulty, grade, w);
    stability =
      grade === 1
        ? nextStabilityFailure(input.stability, input.difficulty, r, w)
        : nextStabilitySuccess(input.stability, input.difficulty, r, grade, w);
  }

  stability = Math.max(MIN_STABILITY, stability);

  return {
    difficulty,
    stability,
    reps: input.reps + 1,
    intervalDays: intervalFromStability(stability, desiredRetention),
  };
}

/** Convenience: default starting state for a card that has never been reviewed under FSRS. Mirrors sm2InitialState(). */
export function fsrsInitialState(): { difficulty: number; stability: number; reps: number } {
  // reps=0 makes fsrs()'s first call take the fresh-card S0/D0 path regardless
  // of these values, same as sm2InitialState()'s easiness only matters once
  // sm2() actually runs its formula on it.
  return { difficulty: FSRS_DEFAULT_WEIGHTS[4]!, stability: 0, reps: 0 };
}

export interface Sm2LikeState {
  easiness: number;
  interval: number;
  repetitions: number;
}

export interface FsrsBootstrapResult {
  difficulty: number;
  stability: number;
  reps: number;
}

// SM-2's easiness has a documented floor (1.3, sm2.ts's MIN_EASINESS) but no
// hard ceiling. In practice sustained "Easy" streaks plateau well under 3.0,
// so that's used as a reasonable assumed span for a linear inverse mapping
// onto FSRS's [1,10] difficulty scale below.
const ASSUMED_MAX_EASINESS = 3.0;
const MIN_EASINESS = 1.3;

/**
 * Bootstraps an FSRS {difficulty, stability} pair from an existing SM-2
 * ReviewState, for a user switching sm2 -> fsrs mid-use (see
 * reviewUsecases.ts). Design, and why:
 *
 *  - stability ~= the SM-2 interval, in days. The two numbers mean almost
 *    the same thing operationally — "how many days can this card go before
 *    it needs reviewing again" — so reusing the interval directly as a
 *    starting stability keeps the card's due date roughly where the
 *    student already expects it, instead of resetting progress to zero on
 *    switch. A card with interval=0 (state row exists — e.g. the very first
 *    SM-2 review already failed, or repetitions got reset — but there's no
 *    real elapsed-days signal yet) falls back to FSRS's own S0(Good) default
 *    (w[2]) rather than stability=0, which would make the card due
 *    immediately purely as a bootstrap artifact.
 *  - difficulty is the inverse of easiness, linearly mapped from SM-2's
 *    documented floor [MIN_EASINESS, ASSUMED_MAX_EASINESS] onto FSRS's
 *    [1,10] difficulty range (low easiness = SM-2 found it hard = high FSRS
 *    difficulty, and vice versa).
 *  - reps carries over as max(1, repetitions), so the caller (submitReview)
 *    can pass this into fsrs() as an "existing card" rather than triggering
 *    the fresh-card S0/D0 bootstrap path there — the whole point of this
 *    function is to preserve progress, not discard it a second time.
 */
export function bootstrapFsrsFromSm2(sm2State: Sm2LikeState): FsrsBootstrapResult {
  const w = FSRS_DEFAULT_WEIGHTS;
  const clampedEasiness = clamp(sm2State.easiness, MIN_EASINESS, ASSUMED_MAX_EASINESS);
  const difficulty = clamp(
    10 - ((clampedEasiness - MIN_EASINESS) / (ASSUMED_MAX_EASINESS - MIN_EASINESS)) * 9,
    MIN_DIFFICULTY,
    MAX_DIFFICULTY,
  );
  const stability = sm2State.interval > 0 ? sm2State.interval : initialStability(3, w);
  return { difficulty, stability, reps: Math.max(1, sm2State.repetitions) };
}

/** Re-exported for callers (reviewUsecases.ts) that need to compute a due date from an FSRS result, mirroring sm2.ts's addDays. */
export { addDays };
