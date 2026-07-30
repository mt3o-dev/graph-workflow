import { describe, test, expect } from "bun:test";
import {
  addPlayer,
  advancePhase,
  computeHint,
  createRoomState,
  crossedStreakThreshold,
  currentStreak,
  isHintEligible,
  recordAnswer,
  requestHint,
  HINT_COST,
  STREAK_BONUS_POINTS,
  STREAK_BONUS_THRESHOLD,
  type LiveQuestion,
  type RoomPlayerAnswer,
  type RoomState,
} from "../src/core/domain/liveQuiz";
import { ValidationError, NotFoundError } from "../src/core/domain/errors";

// Slice 14: streak-bonus detection + hint mechanic, pure domain logic only —
// no sockets, no DB. The durable pending-bonus persistence side (creating/
// resolving core/ports/liveStreakBonusRepoPort.ts records) is covered
// separately in tests/liveStreakBonus.test.ts, since that needs a real
// sqlite db + reviewUsecases.submitReview to exercise the confirm/forfeit
// path end-to-end.

function mkQuestion(n: number): LiveQuestion {
  return {
    cardId: `card-${n}`,
    type: "multiple_choice",
    payload: { question: `${n}+${n}?`, options: ["wrong-a", "right", "wrong-b"], correctIndex: 1 },
  };
}

const questions = Array.from({ length: 6 }, (_, i) => mkQuestion(i));

function freshRoom(): RoomState {
  let room = createRoomState({ code: "ABCDE", hostId: "host-1", setId: "set-1", questions });
  room = addPlayer(room, { userId: "p1", displayName: "Alice" });
  return room;
}

/** Advances the room to put question `index` live, from wherever it currently is (lobby, or mid-round). */
function goToQuestionLive(room: RoomState, index: number, now: Date): RoomState {
  let r = room;
  while (!(r.phase === "question-live" && r.currentQuestionIndex === index)) {
    r = advancePhase(r, now);
  }
  return r;
}

describe("currentStreak / crossedStreakThreshold (pure fixture-driven)", () => {
  function answer(correct: boolean, atMs: number): RoomPlayerAnswer {
    return { cardId: `x-${atMs}`, correct, points: correct ? 1000 : 0, submittedAtMs: atMs };
  }

  test("empty history: streak 0, never crosses", () => {
    expect(currentStreak([])).toBe(0);
    expect(crossedStreakThreshold([])).toBe(false);
  });

  test("below threshold (1-2 correct in a row): no crossing", () => {
    expect(currentStreak([answer(true, 1)])).toBe(1);
    expect(crossedStreakThreshold([answer(true, 1)])).toBe(false);

    const two = [answer(true, 1), answer(true, 2)];
    expect(currentStreak(two)).toBe(2);
    expect(crossedStreakThreshold(two)).toBe(false);
  });

  test("exactly at threshold (3 in a row): crosses, exactly once", () => {
    const three = [answer(true, 1), answer(true, 2), answer(true, 3)];
    expect(currentStreak(three)).toBe(STREAK_BONUS_THRESHOLD);
    expect(crossedStreakThreshold(three)).toBe(true);
  });

  test("past threshold (4, 5, 6 in a row): does NOT re-cross on every subsequent correct answer", () => {
    const four = [answer(true, 1), answer(true, 2), answer(true, 3), answer(true, 4)];
    expect(currentStreak(four)).toBe(4);
    expect(crossedStreakThreshold(four)).toBe(false); // already crossed at length 3, not again at 4

    const six = [...four, answer(true, 5), answer(true, 6)];
    expect(currentStreak(six)).toBe(6);
    expect(crossedStreakThreshold(six)).toBe(false);
  });

  test("a broken streak resets the counter, and can cross again on a fresh run", () => {
    const brokenThenRebuilt = [
      answer(true, 1),
      answer(true, 2),
      answer(true, 3), // crossed here
      answer(false, 4), // streak breaks
      answer(true, 5),
      answer(true, 6),
      answer(true, 7), // crosses again — a NEW crossing event
    ];
    expect(currentStreak(brokenThenRebuilt)).toBe(3);
    expect(crossedStreakThreshold(brokenThenRebuilt)).toBe(true);

    const brokenOnly = brokenThenRebuilt.slice(0, 4); // ends on the wrong answer
    expect(currentStreak(brokenOnly)).toBe(0);
    expect(crossedStreakThreshold(brokenOnly)).toBe(false);
  });
});

describe("recordAnswer: streak bonus integration (same player across several questions)", () => {
  test("streak of 1-2 correct answers: no bonus, normal points only", () => {
    let room = freshRoom();
    const start = new Date("2026-01-01T00:00:00.000Z");
    room = goToQuestionLive(room, 0, start);
    const { room: r1, result: res1 } = recordAnswer(room, "p1", questions[0]!.cardId, "1", start);
    expect(res1.streakBonusAwarded).toBe(false);
    room = r1;

    room = goToQuestionLive(room, 1, new Date(start.getTime() + 1000));
    const { room: r2, result: res2 } = recordAnswer(room, "p1", questions[1]!.cardId, "1", new Date(start.getTime() + 1000));
    expect(res2.streakBonusAwarded).toBe(false);
    room = r2;
  });

  test("the 3rd consecutive correct answer triggers exactly one bonus, on that card only", () => {
    let room = freshRoom();
    const start = new Date("2026-01-01T00:00:00.000Z");
    let lastResult;

    for (let i = 0; i < 3; i++) {
      const now = new Date(start.getTime() + i * 1000);
      room = goToQuestionLive(room, i, now);
      const { room: updated, result } = recordAnswer(room, "p1", questions[i]!.cardId, "1", now);
      room = updated;
      lastResult = result;
    }

    // Each answer is submitted at the exact instant its question goes live
    // (elapsedMs === 0), so scoreAnswer awards the full BASE_POINTS (1000) +
    // MAX_SPEED_BONUS (500) = 1500 on top of the streak bonus for this one.
    expect(lastResult!.streakBonusAwarded).toBe(true);
    expect(lastResult!.points).toBe(1000 + 500 + STREAK_BONUS_POINTS);
    expect(room.players["p1"]!.score).toBe(3 * (1000 + 500) + STREAK_BONUS_POINTS);
  });

  test("a 4th consecutive correct answer does NOT trigger a second bonus", () => {
    let room = freshRoom();
    const start = new Date("2026-01-01T00:00:00.000Z");
    let results: boolean[] = [];

    for (let i = 0; i < 4; i++) {
      const now = new Date(start.getTime() + i * 1000);
      room = goToQuestionLive(room, i, now);
      const { room: updated, result } = recordAnswer(room, "p1", questions[i]!.cardId, "1", now);
      room = updated;
      results.push(result.streakBonusAwarded);
    }

    expect(results).toEqual([false, false, true, false]);
  });

  test("a wrong answer breaks the streak — the counter restarts from the next correct answer", () => {
    let room = freshRoom();
    const start = new Date("2026-01-01T00:00:00.000Z");
    const answersRaw = ["1", "1", "0", "1", "1", "1"]; // correct, correct, WRONG, correct, correct, correct
    const results: boolean[] = [];

    for (let i = 0; i < answersRaw.length; i++) {
      const now = new Date(start.getTime() + i * 1000);
      room = goToQuestionLive(room, i, now);
      const { room: updated, result } = recordAnswer(room, "p1", questions[i]!.cardId, answersRaw[i]!, now);
      room = updated;
      results.push(result.streakBonusAwarded);
    }

    // Never reaches 3 before the break (only 2 in a row), breaks, then
    // rebuilds to exactly 3 in a row at index 5 -> crosses again.
    expect(results).toEqual([false, false, false, false, false, true]);
  });
});

describe("hints", () => {
  const mcQuestion = mkQuestion(0);
  const tfQuestion: LiveQuestion = { cardId: "card-tf", type: "true_false", payload: { statement: "Sky is blue", isTrue: true } };
  const taQuestion: LiveQuestion = { cardId: "card-ta", type: "type_answer", payload: { prompt: "Capital of France?", acceptedAnswers: ["Paris"] } };

  test("isHintEligible: true for multiple_choice/type_answer, false for true_false", () => {
    expect(isHintEligible("multiple_choice")).toBe(true);
    expect(isHintEligible("type_answer")).toBe(true);
    expect(isHintEligible("true_false")).toBe(false);
  });

  test("computeHint for type_answer reveals ONLY first letter + length, never the answer itself", () => {
    const hint = computeHint(taQuestion);
    expect(hint).toEqual({ type: "type_answer", firstLetter: "P", length: 5 }); // "Paris" — not the full word
  });

  test("computeHint for multiple_choice eliminates exactly one WRONG option, never the correct one", () => {
    const rng = () => 0; // deterministic: picks the first wrong index
    const hint = computeHint(mcQuestion, rng);
    const mcPayload = mcQuestion.payload as { options: string[]; correctIndex: number };
    expect(hint.type).toBe("multiple_choice");
    if (hint.type === "multiple_choice") {
      expect(hint.eliminatedIndex).not.toBe(mcPayload.correctIndex);
      expect(hint.eliminatedOption).toBe(mcPayload.options[hint.eliminatedIndex]!);
    }
  });

  test("computeHint throws for true_false — no meaningful partial reveal exists", () => {
    expect(() => computeHint(tfQuestion)).toThrow(ValidationError);
  });

  test("requestHint deducts HINT_COST from the requesting player's own score", () => {
    let room = freshRoom();
    const start = new Date("2026-01-01T00:00:00.000Z");
    room = goToQuestionLive(room, 0, start);

    const { room: updated, hint } = requestHint(room, "p1", questions[0]!.cardId, () => 0);
    expect(updated.players["p1"]!.score).toBe(-HINT_COST);
    expect(hint.type).toBe("multiple_choice");
  });

  test("requestHint is idempotent per (player, question): a second request re-serves the same hint, no double charge", () => {
    let room = freshRoom();
    const start = new Date("2026-01-01T00:00:00.000Z");
    room = goToQuestionLive(room, 0, start);

    const first = requestHint(room, "p1", questions[0]!.cardId, () => 0);
    const second = requestHint(first.room, "p1", questions[0]!.cardId, () => 0.999); // different rng, should NOT be consulted again
    expect(second.hint).toEqual(first.hint);
    expect(second.room.players["p1"]!.score).toBe(-HINT_COST); // charged once, not twice
  });

  test("requestHint throws if the player already answered this question", () => {
    let room = freshRoom();
    const start = new Date("2026-01-01T00:00:00.000Z");
    room = goToQuestionLive(room, 0, start);
    const { room: answered } = recordAnswer(room, "p1", questions[0]!.cardId, "1", start);
    expect(() => requestHint(answered, "p1", questions[0]!.cardId)).toThrow(ValidationError);
  });

  test("requestHint throws when no question is live", () => {
    const room = freshRoom(); // still in lobby
    expect(() => requestHint(room, "p1", questions[0]!.cardId)).toThrow(ValidationError);
  });

  test("requestHint throws for an unknown player", () => {
    let room = freshRoom();
    room = goToQuestionLive(room, 0, new Date());
    expect(() => requestHint(room, "ghost", questions[0]!.cardId)).toThrow(NotFoundError);
  });

  test("requestHint only touches the requesting player's own state, never another player's", () => {
    let room = freshRoom();
    room = addPlayer(room, { userId: "p2", displayName: "Bob" });
    room = goToQuestionLive(room, 0, new Date());

    const { room: updated } = requestHint(room, "p1", questions[0]!.cardId, () => 0);
    expect(updated.players["p2"]!.score).toBe(0);
    expect(updated.players["p2"]!.hints).toEqual({});
  });
});
