// Slice 6 (offline review): client-side scoring. Deliberately does NOT
// reimplement SM-2/FSRS/correctness logic — it imports and calls the exact
// same pure domain functions the server uses in
// src/pages/api/review/answer.ts and rate.ts. Those functions
// (core/domain/quality.ts, core/domain/levenshtein.ts) already have zero I/O
// and zero adapter/astro imports (see docs/architecture.md's hexagonal
// rule), so nothing needed to change to make them bundle-safe for the
// browser — this file just re-exports thin wrappers around them, mirroring
// answer.ts's per-type branching exactly so offline and online scoring can
// never drift apart.
import type { Card, MultipleChoicePayload, TrueFalsePayload, TypeAnswerPayload } from "../../core/domain/types";
import { qualityFromCorrectness, qualityFromSelfRating, type SelfRating } from "../../core/domain/quality";
import { matchesAnyAccepted } from "../../core/domain/levenshtein";
import { t, type Locale } from "../../i18n";

export interface AutoScoreResult {
  correct: boolean;
  correctAnswerText: string;
  quality: ReturnType<typeof qualityFromCorrectness>;
}

/** Mirrors the multiple_choice/true_false/type_answer branches in src/pages/api/review/answer.ts exactly. */
export function scoreAutoAnswer(card: Card, answer: string, locale: Locale): AutoScoreResult {
  let correct = false;
  let correctAnswerText = "";

  if (card.type === "multiple_choice") {
    const payload = card.payload as MultipleChoicePayload;
    correct = Number(answer) === payload.correctIndex;
    correctAnswerText = payload.options[payload.correctIndex] ?? "";
  } else if (card.type === "true_false") {
    const payload = card.payload as TrueFalsePayload;
    correct = (answer === "true") === payload.isTrue;
    correctAnswerText = payload.isTrue ? t("review.trueFalse.true", locale) : t("review.trueFalse.false", locale);
  } else if (card.type === "type_answer") {
    const payload = card.payload as TypeAnswerPayload;
    correct = matchesAnyAccepted(answer, payload.acceptedAnswers);
    correctAnswerText = payload.acceptedAnswers[0] ?? "";
  }

  return { correct, correctAnswerText, quality: qualityFromCorrectness(correct) };
}

/** Mirrors src/pages/api/review/rate.ts's self-rated path exactly. */
export function scoreSelfRating(rating: SelfRating): ReturnType<typeof qualityFromSelfRating> {
  return qualityFromSelfRating(rating);
}

export type { SelfRating };
