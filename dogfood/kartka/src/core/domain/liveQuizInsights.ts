// Slice 16 (teacher insights): pure aggregation over already-recorded
// LiveQuizAnswerRecord rows (see domain/types.ts + liveQuizInsightsUsecases.ts
// for where those rows come from). No DB access here — mirrors
// adminAnalytics.ts's split: the usecase fetches rows via a repo port and
// hands them to these plain functions, which are unit-testable with plain
// fake/seeded arrays.
import type { LiveQuizAnswerRecord } from "./types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Per-question aggregate across a set's ENTIRE live-quiz history (every round, every player). */
export interface QuestionStat {
  cardId: string;
  timesAsked: number;
  timesCorrect: number;
  /** null means this question has never been asked in a live round yet — no data to judge "weak" from. */
  percentCorrect: number | null;
}

/**
 * One row per `cardId` in `cardIds` (the set's CURRENT live-eligible
 * questions — see core/domain/liveQuiz.ts's isLiveEligibleType), even for a
 * card that has never actually been asked (percentCorrect: null, timesAsked:
 * 0) — the roadmap asks for "each of the set's live-eligible questions", not
 * just the ones with history. `records` may contain rows for cardIds no
 * longer in `cardIds` (e.g. a card that was deleted, or changed since it was
 * asked) — those rows are silently ignored, never crash this aggregation.
 *
 * Sorted WEAKEST FIRST (lowest percentCorrect first) so a teacher sees what
 * to re-teach immediately; questions with no data at all (percentCorrect:
 * null) sort last, since "never asked" isn't a weak spot, it's an absence of
 * signal. Ties broken by timesAsked descending (more data first) then
 * `cardIds`' own original order for full determinism.
 */
export function aggregateQuestionStats(cardIds: readonly string[], records: readonly LiveQuizAnswerRecord[]): QuestionStat[] {
  const buckets = new Map<string, { asked: number; correct: number }>();
  for (const cardId of cardIds) buckets.set(cardId, { asked: 0, correct: 0 });

  for (const record of records) {
    const bucket = buckets.get(record.cardId);
    if (!bucket) continue; // defensive: card no longer live-eligible/deleted since this round
    bucket.asked += 1;
    if (record.correct) bucket.correct += 1;
  }

  return cardIds
    .map((cardId, originalIndex) => {
      const bucket = buckets.get(cardId)!;
      const percentCorrect = bucket.asked === 0 ? null : round1((bucket.correct / bucket.asked) * 100);
      return { cardId, timesAsked: bucket.asked, timesCorrect: bucket.correct, percentCorrect, originalIndex };
    })
    .sort((a, b) => {
      if (a.percentCorrect === null && b.percentCorrect === null) return a.originalIndex - b.originalIndex;
      if (a.percentCorrect === null) return 1;
      if (b.percentCorrect === null) return -1;
      return a.percentCorrect - b.percentCorrect || b.timesAsked - a.timesAsked || a.originalIndex - b.originalIndex;
    })
    .map(({ cardId, timesAsked, timesCorrect, percentCorrect }) => ({ cardId, timesAsked, timesCorrect, percentCorrect }));
}

/**
 * One player's aggregate accuracy across a set's entire live-quiz history.
 * `userId` is kept here (it's what the write side/ownership checks need to
 * stay correct) but `anonymizedIndex` — NOT userId, NOT any display name —
 * is the only thing this slice's UI is allowed to show (roadmap point 3: the
 * per-student breakdown must never leak a real display name). See
 * aggregateStudentStats' header comment for how the index is assigned.
 */
export interface StudentStat {
  userId: string;
  /** 1-based, stable across repeated calls against the same underlying records — see header comment. */
  anonymizedIndex: number;
  timesAnswered: number;
  timesCorrect: number;
  percentCorrect: number;
}

/**
 * Aggregates per-player accuracy, labeling each player only by an anonymous
 * 1-based index assigned in FIRST-EVER-SEEN order (earliest `finishedAt`
 * across all of this set's recorded rounds) — so "Student 1" is always the
 * same real player across repeated calls against the same data (consistent
 * across page loads, per the roadmap), without this function — or its
 * caller — ever needing to expose which real userId that is. The caller
 * (liveQuizInsightsUsecases.getSetInsights) hands this the FULL set of
 * historical records every time, so first-seen order is recomputed fresh
 * each call rather than relying on any stored/cached assignment; as long as
 * the underlying rows don't change between two calls, the result is
 * identical (deterministic function of the same input).
 *
 * Review found a real gap here: every row of one round is written with the
 * SAME `finishedAt` (see liveQuizInsightsUsecases.recordLiveQuizRoundInsights),
 * so any round with 2+ players — the normal case, not an edge case — ties on
 * `finishedAt` alone. A plain stable sort then falls back to `records`' input
 * order, which comes straight from a `SELECT` with no `ORDER BY` in either
 * repo adapter — not a guaranteed invariant in SQLite or Postgres. Sorting by
 * `id` (a per-row random string, stable and content-derived, never
 * insertion-order-dependent) as an explicit secondary key closes this: the
 * result is now a pure function of the row DATA, never of incidental
 * DB/array ordering, which is what "deterministic" above actually promises.
 */
export function aggregateStudentStats(records: readonly LiveQuizAnswerRecord[]): StudentStat[] {
  const chronological = [...records].sort((a, b) => a.finishedAt.getTime() - b.finishedAt.getTime() || a.id.localeCompare(b.id));
  const firstSeenOrder: string[] = [];
  const seen = new Set<string>();
  for (const record of chronological) {
    if (!seen.has(record.userId)) {
      seen.add(record.userId);
      firstSeenOrder.push(record.userId);
    }
  }
  const anonymizedIndexByUser = new Map(firstSeenOrder.map((userId, i) => [userId, i + 1]));

  const buckets = new Map<string, { answered: number; correct: number }>();
  for (const record of records) {
    const bucket = buckets.get(record.userId) ?? { answered: 0, correct: 0 };
    bucket.answered += 1;
    if (record.correct) bucket.correct += 1;
    buckets.set(record.userId, bucket);
  }

  return [...buckets.entries()]
    .map(([userId, bucket]) => ({
      userId,
      anonymizedIndex: anonymizedIndexByUser.get(userId)!,
      timesAnswered: bucket.answered,
      timesCorrect: bucket.correct,
      percentCorrect: bucket.answered === 0 ? 0 : round1((bucket.correct / bucket.answered) * 100),
    }))
    .sort((a, b) => a.anonymizedIndex - b.anonymizedIndex);
}
