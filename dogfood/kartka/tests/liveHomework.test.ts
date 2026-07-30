import { describe, test, expect } from "bun:test";
import {
  daysUntilDeadline,
  homeworkDeadlineInstant,
  homeworkLeaderboard,
  homeworkQuestions,
  isDeadlinePassed,
  scoreHomeworkAnswer,
  toUtcDateString,
} from "../src/core/domain/liveHomework";
import type { LiveQuestion } from "../src/core/domain/liveQuiz";
import type { Card } from "../src/core/domain/types";

// Pure-domain tests for slice 17's homework mode. Zero DB/usecase involvement
// — the DB-backed ownership/attempt/concurrency behaviour lives in
// tests/liveHomeworkUsecases.test.ts.

function mcCard(id: string, correctIndex: number): Card {
  return {
    id,
    setId: "set-1",
    type: "multiple_choice",
    sourceCardId: null,
    payload: { question: `Q-${id}`, options: ["a", "b", "c"], correctIndex },
    createdAt: new Date(0),
  } as Card;
}

describe("deadline handling (slice 8 timezone-fix reuse)", () => {
  test('an <input type=date> "today" is accepted regardless of server timezone / real clock time on now', () => {
    // now has a REAL clock time (afternoon), not midnight — the exact shape
    // slice 8's fix was verified with. The date input value for "today" parses
    // as UTC midnight; the comparison is by UTC calendar-date STRING, so a
    // same-day deadline is never wrongly rejected as "in the past".
    const now = new Date("2026-07-30T14:37:12.000Z");
    const todayDateInput = new Date("2026-07-30"); // UTC midnight, as ECMA-262 parses a date-only string
    expect(toUtcDateString(todayDateInput) < toUtcDateString(now)).toBe(false); // "today" is NOT before today
  });

  test("the deadline instant is the very end of the chosen UTC day", () => {
    const deadline = homeworkDeadlineInstant(new Date("2026-08-01"));
    expect(deadline.toISOString()).toBe("2026-08-01T23:59:59.999Z");
  });

  test("isDeadlinePassed is strict: an instant before/at the deadline is open, after is closed", () => {
    const deadline = homeworkDeadlineInstant(new Date("2026-08-01"));
    expect(isDeadlinePassed(deadline, new Date("2026-08-01T23:59:59.999Z"))).toBe(false); // exactly at
    expect(isDeadlinePassed(deadline, new Date("2026-08-01T12:00:00.000Z"))).toBe(false); // before
    expect(isDeadlinePassed(deadline, new Date("2026-08-02T00:00:00.000Z"))).toBe(true); // after
  });

  test("daysUntilDeadline never goes negative and is 0 on the deadline day", () => {
    const deadline = homeworkDeadlineInstant(new Date("2026-08-05"));
    expect(daysUntilDeadline(deadline, new Date("2026-08-01T00:00:00.000Z"))).toBe(5);
    expect(daysUntilDeadline(deadline, new Date("2026-08-05T10:00:00.000Z"))).toBe(1);
    expect(daysUntilDeadline(deadline, new Date("2026-08-10T00:00:00.000Z"))).toBe(0);
  });
});

describe("homeworkQuestions", () => {
  test("keeps only live-eligible cards, in a stable id order", () => {
    const cards: Card[] = [
      mcCard("c3", 0),
      { id: "c-basic", setId: "set-1", type: "basic", sourceCardId: null, payload: { front: "f", back: "b" }, createdAt: new Date(0) } as Card,
      mcCard("c1", 1),
      mcCard("c2", 2),
    ];
    const qs = homeworkQuestions(cards);
    expect(qs.map((q) => q.cardId)).toEqual(["c1", "c2", "c3"]); // basic excluded, sorted by id
  });
});

describe("scoreHomeworkAnswer (base correctness, no speed bonus)", () => {
  const q: LiveQuestion = { cardId: "c1", type: "multiple_choice", payload: { question: "Q", options: ["a", "b", "c"], correctIndex: 1 } };
  test("a correct answer is worth exactly 1 point — no elapsed-time input exists to bonus on", () => {
    expect(scoreHomeworkAnswer(q, "1")).toEqual({ correct: true, points: 1 });
  });
  test("a wrong answer is 0", () => {
    expect(scoreHomeworkAnswer(q, "0")).toEqual({ correct: false, points: 0 });
  });
});

describe("homeworkLeaderboard (individual-only, full deterministic tiebreak)", () => {
  test("higher score first; equal score ranks the earlier finisher first; in-progress (null completedAt) sorts last", () => {
    const board = homeworkLeaderboard([
      { userId: "u-late", displayName: "Zoe", score: 3, completedAt: new Date("2026-08-01T10:00:00Z") },
      { userId: "u-early", displayName: "Amy", score: 3, completedAt: new Date("2026-08-01T09:00:00Z") },
      { userId: "u-inprogress", displayName: "Bob", score: 3, completedAt: null },
      { userId: "u-low", displayName: "Cid", score: 1, completedAt: new Date("2026-08-01T08:00:00Z") },
    ]);
    expect(board.map((e) => e.userId)).toEqual(["u-early", "u-late", "u-inprogress", "u-low"]);
    // Standard competition ranking: the three score-3 rows differ on completion
    // time, so they are NOT tied ranks — 1, 2, 3, then 4.
    expect(board.map((e) => e.rank)).toEqual([1, 2, 3, 4]);
  });

  test("a genuine full tie (same score AND same completion instant) shares a rank, broken only for order by displayName/userId", () => {
    const t = new Date("2026-08-01T09:00:00Z");
    const board = homeworkLeaderboard([
      { userId: "u2", displayName: "Bob", score: 2, completedAt: t },
      { userId: "u1", displayName: "Amy", score: 2, completedAt: t },
      { userId: "u3", displayName: "Cid", score: 1, completedAt: t },
    ]);
    expect(board.map((e) => e.userId)).toEqual(["u1", "u2", "u3"]);
    expect(board.map((e) => e.rank)).toEqual([1, 1, 3]); // Amy & Bob genuinely tie rank 1; Cid is rank 3
  });
});
