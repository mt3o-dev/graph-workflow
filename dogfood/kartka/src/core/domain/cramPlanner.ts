// Cram-mode session planner (slice 8). Pure function, no side effects, no
// framework/adapter imports — see docs/architecture.md for the hexagonal
// rule and sm2.ts/fsrs.ts for the sibling pure-domain algorithms.
//
// SAFETY CONSTRAINT (non-negotiable, see roadmap.md's slice 8 line and the
// slice spec): this module only ever *reads* scheduler state to decide which
// cards to select and in what order. It never computes a new dueAt/interval/
// stability, never mutates anything, and has no notion of "writing back" —
// there is nothing here for a caller to accidentally persist. Actual reviews
// of the cards this planner selects still go through the exact same
// submitReview() usecase as any normal review (see cramUsecases.ts), so the
// scheduler state evolves through its normal, already-tested mechanism.
// Compression of the review schedule happens by *selecting more cards more
// often*, not by editing stored schedule data.

import type { ReviewState, FsrsReviewState } from "./types";

/** One card's current scheduler state, as known to the caller (cramUsecases.ts) via scheduler.get(). */
export interface CramCardInput {
  cardId: string;
  /** null = never reviewed by this user under the active scheduler. */
  state: ReviewState | FsrsReviewState | null;
}

export interface CramPlannerInput {
  cards: CramCardInput[];
  /** null = cram mode isn't active for this set (no examDate set) — see setUsecases.setExamDate. */
  examDate: Date | null;
  now: Date;
  /** Cap on how many cards one cram session surfaces at once. Default DEFAULT_SESSION_CAP. */
  sessionCap?: number;
  /** Assumed sane per-day review pace used to decide what can realistically be covered before the exam. Default DEFAULT_PACE_PER_DAY. */
  pacePerDay?: number;
}

export interface CramPlannerResult {
  /** false when examDate is null — every other field is then empty/irrelevant, per the "explicit off" contract. */
  active: boolean;
  /** Whole days remaining until the exam (>= 0), or null when inactive. */
  daysUntilExam: number | null;
  /** Card ids for today's session, in priority order, capped to sessionCap. */
  selected: string[];
  /**
   * Card ids that need attention (never reviewed, weak, or due-after-exam)
   * but don't fit in the remaining days at pacePerDay — the "N cards won't
   * get proper attention before your exam" warning data. Does NOT overlap
   * with `selected`'s cards that fit within capacity; a card can still show
   * up in `selected` (today's actual session) while other, lower-priority
   * needing-attention cards are deprioritized.
   */
  deprioritized: string[];
}

export const DEFAULT_SESSION_CAP = 40;
export const DEFAULT_PACE_PER_DAY = 20;

/** A card is considered "mastered" (deprioritized relative to weak/new cards) above this normalized strength. */
const MASTERY_THRESHOLD = 0.85;

// Priority weights. Never-reviewed cards always outrank everything else;
// "due at/after the exam" (would never naturally come up in time) is next;
// weakness fills the remainder. See planCramSession()'s scoring loop.
const NEVER_REVIEWED_WEIGHT = 100;
const LATE_WEIGHT = 40;
const WEAKNESS_WEIGHT = 30;

// SM-2's easiness has a documented floor (1.3) but no hard ceiling; mirrors
// fsrs.ts's bootstrapFsrsFromSm2 assumption that sustained "Easy" streaks
// plateau well under 3.0, used here as a reasonable span for normalizing
// easiness onto a 0..1 "strength" scale.
const MIN_EASINESS = 1.3;
const ASSUMED_MAX_EASINESS = 3.0;
// FSRS stability is already "days this card can go before it's due again" —
// treat a card stable for 60+ days as fully mastered for cram-prioritization
// purposes (an assumed span, not a hard FSRS constant).
const ASSUMED_MAX_STABILITY_DAYS = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function isSm2State(state: ReviewState | FsrsReviewState): state is ReviewState {
  return "easiness" in state;
}

/**
 * Normalizes whatever the active scheduler tracks onto a common 0 (weakest)
 * .. 1 (mastered) "strength" scale, so the priority scoring below doesn't
 * need to know or care which scheduler is active. A card with no state at
 * all (never reviewed) normalizes to 0 — its priority actually comes from
 * the separate never-reviewed bonus, not from this, but 0 is still the
 * correct "weakest" value if this were ever read on its own.
 */
function strengthOf(state: ReviewState | FsrsReviewState | null): number {
  if (!state) return 0;
  if (isSm2State(state)) return clamp01((state.easiness - MIN_EASINESS) / (ASSUMED_MAX_EASINESS - MIN_EASINESS));
  return clamp01(state.stability / ASSUMED_MAX_STABILITY_DAYS);
}

interface ScoredCard {
  cardId: string;
  score: number;
  needsAttention: boolean;
}

/** Deterministic ordering: score descending, then cardId ascending as a stable tiebreaker (no randomness anywhere in this module). */
function byPriority(a: ScoredCard, b: ScoredCard): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0;
}

/**
 * Computes a priority-ordered cram session for one set, plus the honest
 * "these won't get proper attention in time" list. Deterministic given the
 * same inputs (same cardIds/states/examDate/now sorted the same way) — no
 * randomness, safe to unit-test with fixed fixtures.
 *
 * Priority score per card =
 *   (never reviewed ? NEVER_REVIEWED_WEIGHT : 0)
 *   + (1 - strength) * WEAKNESS_WEIGHT
 *   + (dueAt >= examDate ? LATE_WEIGHT : 0)
 *
 * "Needs attention" (the candidate pool cram mode cares about at all) is
 * never-reviewed OR strength below MASTERY_THRESHOLD OR due at/after the
 * exam date. Cards outside that pool ("mastered", on track, due comfortably
 * before the exam) are still included at the bottom of the priority order
 * (so a small/easy set still fills out a full session), but never count
 * against the per-day pace capacity and never appear in `deprioritized`.
 *
 * Capacity = daysUntilExam * pacePerDay (or just pacePerDay if the exam is
 * today/overdue — one day's worth of pace still applies). Needing-attention
 * cards beyond that capacity, in priority order, are the ones cram mode
 * honestly admits it can't get to in time.
 */
export function planCramSession(input: CramPlannerInput): CramPlannerResult {
  const sessionCap = input.sessionCap ?? DEFAULT_SESSION_CAP;
  const pacePerDay = input.pacePerDay ?? DEFAULT_PACE_PER_DAY;

  if (!input.examDate) {
    return { active: false, daysUntilExam: null, selected: [], deprioritized: [] };
  }
  const examDate = input.examDate;

  const daysUntilExam = Math.max(0, Math.ceil((examDate.getTime() - input.now.getTime()) / MS_PER_DAY));

  const scored: ScoredCard[] = input.cards.map((c) => {
    const reviewed = c.state !== null;
    const strength = strengthOf(c.state);
    const dueAt = c.state?.dueAt ?? null;
    const late = dueAt !== null && dueAt.getTime() >= examDate.getTime();

    const score = (reviewed ? 0 : NEVER_REVIEWED_WEIGHT) + (1 - strength) * WEAKNESS_WEIGHT + (late ? LATE_WEIGHT : 0);
    const needsAttention = !reviewed || strength < MASTERY_THRESHOLD || late;

    return { cardId: c.cardId, score, needsAttention };
  });

  const needing = scored.filter((s) => s.needsAttention).sort(byPriority);
  const mastered = scored.filter((s) => !s.needsAttention).sort(byPriority);

  const capacity = daysUntilExam === 0 ? pacePerDay : daysUntilExam * pacePerDay;
  const fitCount = Math.min(capacity, needing.length);
  const fitting = needing.slice(0, fitCount);
  const deprioritized = needing.slice(fitCount).map((s) => s.cardId);

  const selected = [...fitting, ...mastered].slice(0, sessionCap).map((s) => s.cardId);

  return { active: true, daysUntilExam, selected, deprioritized };
}
