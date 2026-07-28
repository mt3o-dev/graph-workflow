import type { ReviewQuality } from "./types";

// Maps the review UI's per-question-type feedback to a 0-5 SM-2 quality score.
// Auto-checkable types (multiple_choice, true_false, type_answer) derive quality
// from correctness; self-rated types (basic, cloze, image_occlusion) pass the
// student's own Again/Hard/Good/Easy button straight through.

export const AUTO_CORRECT: ReviewQuality = 4;
export const AUTO_INCORRECT: ReviewQuality = 1;

/** Self-rated buttons shown for basic/cloze/image_occlusion review cards. */
export const SELF_RATING = {
  again: 1,
  hard: 2,
  good: 4,
  easy: 5,
} as const satisfies Record<string, ReviewQuality>;

export type SelfRating = keyof typeof SELF_RATING;

export function qualityFromCorrectness(correct: boolean): ReviewQuality {
  return correct ? AUTO_CORRECT : AUTO_INCORRECT;
}

export function qualityFromSelfRating(rating: SelfRating): ReviewQuality {
  return SELF_RATING[rating];
}
