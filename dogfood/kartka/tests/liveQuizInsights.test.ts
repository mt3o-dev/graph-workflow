import { describe, test, expect } from "bun:test";
import { aggregateQuestionStats, aggregateStudentStats } from "../src/core/domain/liveQuizInsights";
import type { LiveQuizAnswerRecord } from "../src/core/domain/types";

// Pure aggregation tests for slice 16 (teacher insights) — zero DB/usecase
// involvement, mirrors tests/liveQuiz.test.ts's split for the pure
// computeMissedQuestionsForPlayer detection (slice 15). DB-backed
// write-path + ownership tests live in tests/liveQuizInsightsUsecases.test.ts.

function record(overrides: Partial<LiveQuizAnswerRecord>): LiveQuizAnswerRecord {
  return {
    id: crypto.randomUUID(),
    roomCode: "ROOM1",
    setId: "set-1",
    hostId: "host-1",
    cardId: "card-1",
    userId: "user-1",
    correct: true,
    finishedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("aggregateQuestionStats", () => {
  test("computes timesAsked + percentCorrect per card, weakest-first", () => {
    const records: LiveQuizAnswerRecord[] = [
      // card-A: 1 of 4 correct = 25%
      record({ cardId: "card-A", userId: "u1", correct: false }),
      record({ cardId: "card-A", userId: "u2", correct: false }),
      record({ cardId: "card-A", userId: "u3", correct: false }),
      record({ cardId: "card-A", userId: "u4", correct: true }),
      // card-B: 3 of 4 correct = 75%
      record({ cardId: "card-B", userId: "u1", correct: true }),
      record({ cardId: "card-B", userId: "u2", correct: true }),
      record({ cardId: "card-B", userId: "u3", correct: true }),
      record({ cardId: "card-B", userId: "u4", correct: false }),
    ];

    const stats = aggregateQuestionStats(["card-A", "card-B"], records);
    expect(stats).toHaveLength(2);
    // weakest (card-A, 25%) sorts first
    expect(stats[0]!.cardId).toBe("card-A");
    expect(stats[0]!.timesAsked).toBe(4);
    expect(stats[0]!.timesCorrect).toBe(1);
    expect(stats[0]!.percentCorrect).toBe(25);
    expect(stats[1]!.cardId).toBe("card-B");
    expect(stats[1]!.percentCorrect).toBe(75);
  });

  test("a live-eligible card with zero history gets percentCorrect: null and sorts LAST (not treated as weakest)", () => {
    const records: LiveQuizAnswerRecord[] = [
      record({ cardId: "card-weak", correct: false }),
      record({ cardId: "card-weak", correct: false }),
    ];
    const stats = aggregateQuestionStats(["card-weak", "card-never-asked"], records);
    expect(stats[0]!.cardId).toBe("card-weak");
    expect(stats[0]!.percentCorrect).toBe(0);
    expect(stats[1]!.cardId).toBe("card-never-asked");
    expect(stats[1]!.percentCorrect).toBeNull();
    expect(stats[1]!.timesAsked).toBe(0);
  });

  test("ignores records for cardIds not in the current live-eligible set (e.g. a deleted/retyped card)", () => {
    const records: LiveQuizAnswerRecord[] = [record({ cardId: "card-gone", correct: true })];
    const stats = aggregateQuestionStats(["card-still-here"], records);
    expect(stats).toHaveLength(1);
    expect(stats[0]!.cardId).toBe("card-still-here");
    expect(stats[0]!.timesAsked).toBe(0);
  });

  test("ties in percentCorrect break by timesAsked descending (more data first)", () => {
    const records: LiveQuizAnswerRecord[] = [
      // both 50%, but card-more has more history
      record({ cardId: "card-fewer", userId: "u1", correct: true }),
      record({ cardId: "card-fewer", userId: "u2", correct: false }),
      record({ cardId: "card-more", userId: "u1", correct: true }),
      record({ cardId: "card-more", userId: "u2", correct: false }),
      record({ cardId: "card-more", userId: "u3", correct: true }),
      record({ cardId: "card-more", userId: "u4", correct: false }),
    ];
    const stats = aggregateQuestionStats(["card-fewer", "card-more"], records);
    expect(stats[0]!.cardId).toBe("card-more");
    expect(stats[1]!.cardId).toBe("card-fewer");
  });
});

describe("aggregateStudentStats", () => {
  test("computes per-player accuracy and assigns anonymizedIndex by first-ever-seen order", () => {
    const records: LiveQuizAnswerRecord[] = [
      record({ userId: "user-bob", correct: true, finishedAt: new Date("2026-01-02T00:00:00.000Z") }),
      record({ userId: "user-alice", correct: true, finishedAt: new Date("2026-01-01T00:00:00.000Z") }), // seen first, chronologically
      record({ userId: "user-alice", correct: false, finishedAt: new Date("2026-01-01T00:00:00.000Z") }),
      record({ userId: "user-bob", correct: false, finishedAt: new Date("2026-01-02T00:00:00.000Z") }),
    ];
    const stats = aggregateStudentStats(records);
    expect(stats).toHaveLength(2);

    const alice = stats.find((s) => s.userId === "user-alice")!;
    const bob = stats.find((s) => s.userId === "user-bob")!;
    // alice's earliest row is chronologically before bob's -> she's "Student 1"
    expect(alice.anonymizedIndex).toBe(1);
    expect(bob.anonymizedIndex).toBe(2);
    expect(alice.timesAnswered).toBe(2);
    expect(alice.timesCorrect).toBe(1);
    expect(alice.percentCorrect).toBe(50);
  });

  test("anonymizedIndex is STABLE across repeated calls against the same underlying records (consistent across page loads)", () => {
    const records: LiveQuizAnswerRecord[] = [
      record({ userId: "user-a", finishedAt: new Date("2026-02-01T00:00:00.000Z") }),
      record({ userId: "user-b", finishedAt: new Date("2026-02-02T00:00:00.000Z") }),
      record({ userId: "user-c", finishedAt: new Date("2026-02-03T00:00:00.000Z") }),
    ];
    const first = aggregateStudentStats(records);
    const second = aggregateStudentStats([...records].reverse()); // order-of-array-input shouldn't matter
    expect(first.map((s) => [s.userId, s.anonymizedIndex])).toEqual(second.map((s) => [s.userId, s.anonymizedIndex]));
  });

  test("never exposes a real display name — only userId (internal) and anonymizedIndex are present on the returned shape", () => {
    const records: LiveQuizAnswerRecord[] = [record({ userId: "user-x" })];
    const stats = aggregateStudentStats(records);
    expect(Object.keys(stats[0]!).sort()).toEqual(["anonymizedIndex", "percentCorrect", "timesAnswered", "timesCorrect", "userId"].sort());
  });
});
