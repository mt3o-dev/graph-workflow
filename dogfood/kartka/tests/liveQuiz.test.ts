import { describe, test, expect } from "bun:test";
import {
  addPlayer,
  advancePhase,
  createRoomState,
  generateRoomCode,
  isAnswerCorrect,
  isLiveEligibleType,
  isValidRoomCode,
  recordAnswer,
  scoreAnswer,
  scoreboard,
  toPublicQuestion,
  BASE_POINTS,
  MAX_SPEED_BONUS,
  QUESTION_TIME_LIMIT_MS,
  type LiveQuestion,
} from "../src/core/domain/liveQuiz";
import { ValidationError, NotFoundError } from "../src/core/domain/errors";

const mcQuestion: LiveQuestion = {
  cardId: "card-mc",
  type: "multiple_choice",
  payload: { question: "2+2?", options: ["3", "4", "5"], correctIndex: 1 },
};
const tfQuestion: LiveQuestion = {
  cardId: "card-tf",
  type: "true_false",
  payload: { statement: "The sky is blue", isTrue: true },
};
const taQuestion: LiveQuestion = {
  cardId: "card-ta",
  type: "type_answer",
  payload: { prompt: "Capital of France?", acceptedAnswers: ["Paris"] },
};

describe("room codes", () => {
  test("generateRoomCode produces codes of the expected length and alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(5);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  test("isValidRoomCode rejects malformed input", () => {
    expect(isValidRoomCode("")).toBe(false);
    expect(isValidRoomCode("ABC")).toBe(false);
    expect(isValidRoomCode("ABCDEF")).toBe(false);
    // ambiguous chars 0/O/1/I/L are not in the alphabet
    expect(isValidRoomCode("ABC0E")).toBe(false);
    expect(isValidRoomCode("ABC1E")).toBe(false);
  });

  test("is practically unique across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) seen.add(generateRoomCode());
    expect(seen.size).toBe(3000);
  });
});

describe("isLiveEligibleType", () => {
  test("only multiple_choice/true_false/type_answer are eligible", () => {
    expect(isLiveEligibleType("multiple_choice")).toBe(true);
    expect(isLiveEligibleType("true_false")).toBe(true);
    expect(isLiveEligibleType("type_answer")).toBe(true);
    expect(isLiveEligibleType("basic")).toBe(false);
    expect(isLiveEligibleType("cloze")).toBe(false);
    expect(isLiveEligibleType("image_occlusion")).toBe(false);
  });
});

describe("toPublicQuestion strips the correct answer", () => {
  test("multiple_choice: keeps options, drops correctIndex", () => {
    const pub = toPublicQuestion(mcQuestion) as { options: string[]; correctIndex?: number };
    expect(pub.options).toEqual(["3", "4", "5"]);
    expect(pub).not.toHaveProperty("correctIndex");
  });

  test("true_false: keeps statement, drops isTrue", () => {
    const pub = toPublicQuestion(tfQuestion) as { statement: string; isTrue?: boolean };
    expect(pub.statement).toBe("The sky is blue");
    expect(pub).not.toHaveProperty("isTrue");
  });

  test("type_answer: keeps prompt, drops acceptedAnswers", () => {
    const pub = toPublicQuestion(taQuestion) as { prompt: string; acceptedAnswers?: string[] };
    expect(pub.prompt).toBe("Capital of France?");
    expect(pub).not.toHaveProperty("acceptedAnswers");
  });
});

describe("isAnswerCorrect (per question type)", () => {
  test("multiple_choice: correct/incorrect index", () => {
    expect(isAnswerCorrect(mcQuestion, "1")).toBe(true);
    expect(isAnswerCorrect(mcQuestion, "0")).toBe(false);
    expect(isAnswerCorrect(mcQuestion, "not-a-number")).toBe(false);
  });

  test("true_false: matches the boolean statement", () => {
    expect(isAnswerCorrect(tfQuestion, "true")).toBe(true);
    expect(isAnswerCorrect(tfQuestion, "false")).toBe(false);
  });

  test("type_answer: exact and fuzzy (typo-tolerant) matches, via the real levenshtein helper", () => {
    expect(isAnswerCorrect(taQuestion, "Paris")).toBe(true);
    expect(isAnswerCorrect(taQuestion, "paris")).toBe(true);
    expect(isAnswerCorrect(taQuestion, "Pariss")).toBe(true); // one-char typo, within tolerance
    expect(isAnswerCorrect(taQuestion, "London")).toBe(false);
  });
});

describe("scoreAnswer (base + speed bonus formula)", () => {
  test("wrong answer scores 0 regardless of speed", () => {
    expect(scoreAnswer(mcQuestion, "0", 0).points).toBe(0);
    expect(scoreAnswer(mcQuestion, "0", 500).points).toBe(0);
  });

  test("instant correct answer gets the full speed bonus", () => {
    const result = scoreAnswer(mcQuestion, "1", 0);
    expect(result.correct).toBe(true);
    expect(result.points).toBe(BASE_POINTS + MAX_SPEED_BONUS);
  });

  test("correct answer right at the time limit gets zero speed bonus", () => {
    const result = scoreAnswer(mcQuestion, "1", QUESTION_TIME_LIMIT_MS);
    expect(result.points).toBe(BASE_POINTS);
  });

  test("correct answer halfway through gets roughly half the speed bonus", () => {
    const result = scoreAnswer(mcQuestion, "1", QUESTION_TIME_LIMIT_MS / 2);
    expect(result.points).toBe(BASE_POINTS + Math.round(MAX_SPEED_BONUS / 2));
  });

  test("elapsed time is clamped: negative or over-the-limit never breaks the formula", () => {
    expect(scoreAnswer(mcQuestion, "1", -1000).points).toBe(BASE_POINTS + MAX_SPEED_BONUS);
    expect(scoreAnswer(mcQuestion, "1", QUESTION_TIME_LIMIT_MS * 10).points).toBe(BASE_POINTS);
  });
});

describe("room state transitions", () => {
  function freshRoom() {
    return createRoomState({ code: "ABCDE", hostId: "host-1", setId: "set-1", questions: [mcQuestion, tfQuestion, taQuestion] });
  }

  test("createRoomState starts in lobby with no current question", () => {
    const room = freshRoom();
    expect(room.phase).toBe("lobby");
    expect(room.currentQuestionIndex).toBe(-1);
    expect(room.players).toEqual({});
  });

  test("createRoomState rejects an empty question list", () => {
    expect(() => createRoomState({ code: "ABCDE", hostId: "host-1", setId: "set-1", questions: [] })).toThrow(ValidationError);
  });

  test("addPlayer adds a new player with score 0; rejoining keeps the existing score", () => {
    let room = freshRoom();
    room = addPlayer(room, { userId: "p1", displayName: "Alice" });
    expect(room.players["p1"]?.score).toBe(0);

    room = { ...room, players: { ...room.players, p1: { ...room.players["p1"]!, score: 500 } } };
    room = addPlayer(room, { userId: "p1", displayName: "Alice (renamed)" });
    expect(room.players["p1"]?.score).toBe(500);
    expect(room.players["p1"]?.displayName).toBe("Alice (renamed)");
  });

  test("advancePhase: lobby -> question-live -> reveal -> next question-live -> ... -> finished", () => {
    let room = freshRoom();
    const now = new Date("2026-01-01T00:00:00Z");

    room = advancePhase(room, now);
    expect(room.phase).toBe("question-live");
    expect(room.currentQuestionIndex).toBe(0);
    expect(room.questionStartedAtMs).toBe(now.getTime());

    room = advancePhase(room, now);
    expect(room.phase).toBe("reveal");
    expect(room.currentQuestionIndex).toBe(0); // index doesn't move on reveal

    room = advancePhase(room, now);
    expect(room.phase).toBe("question-live");
    expect(room.currentQuestionIndex).toBe(1);

    room = advancePhase(room, now); // reveal q2
    room = advancePhase(room, now); // -> question-live q3 (last one)
    expect(room.currentQuestionIndex).toBe(2);
    room = advancePhase(room, now); // reveal q3
    room = advancePhase(room, now); // no more questions -> finished
    expect(room.phase).toBe("finished");

    // Advancing a finished room is a no-op, not an error.
    const stillFinished = advancePhase(room, now);
    expect(stillFinished.phase).toBe("finished");
  });

  test("recordAnswer requires the room to be question-live", () => {
    let room = freshRoom();
    room = addPlayer(room, { userId: "p1", displayName: "Alice" });
    expect(() => recordAnswer(room, "p1", mcQuestion.cardId, "1", new Date())).toThrow(ValidationError);
  });

  test("recordAnswer rejects an answer for a card that isn't the current question", () => {
    let room = freshRoom();
    room = addPlayer(room, { userId: "p1", displayName: "Alice" });
    room = advancePhase(room, new Date()); // question-live, index 0 (mcQuestion)
    expect(() => recordAnswer(room, "p1", tfQuestion.cardId, "true", new Date())).toThrow(ValidationError);
  });

  test("recordAnswer rejects an unknown player", () => {
    let room = freshRoom();
    room = advancePhase(room, new Date());
    expect(() => recordAnswer(room, "ghost", mcQuestion.cardId, "1", new Date())).toThrow(NotFoundError);
  });

  test("recordAnswer rejects a second answer to the same question from the same player", () => {
    let room = freshRoom();
    room = addPlayer(room, { userId: "p1", displayName: "Alice" });
    room = advancePhase(room, new Date());
    const now = new Date();
    const { room: afterFirst } = recordAnswer(room, "p1", mcQuestion.cardId, "1", now);
    expect(() => recordAnswer(afterFirst, "p1", mcQuestion.cardId, "1", now)).toThrow(ValidationError);
  });

  test("recordAnswer updates score and per-question answer record", () => {
    let room = freshRoom();
    room = addPlayer(room, { userId: "p1", displayName: "Alice" });
    const start = new Date("2026-01-01T00:00:00.000Z");
    room = advancePhase(room, start);

    const answeredAt = new Date(start.getTime() + 1000); // 1s in
    const { room: updated, result } = recordAnswer(room, "p1", mcQuestion.cardId, "1", answeredAt);
    expect(result.correct).toBe(true);
    expect(updated.players["p1"]?.score).toBe(result.points);
    expect(updated.players["p1"]?.answers[mcQuestion.cardId]?.correct).toBe(true);
  });
});

describe("scoreboard", () => {
  test("orders by score descending, ties broken by display name", () => {
    let room = createRoomState({ code: "ABCDE", hostId: "host-1", setId: "set-1", questions: [mcQuestion] });
    room = addPlayer(room, { userId: "p1", displayName: "Zed" });
    room = addPlayer(room, { userId: "p2", displayName: "Alice" });
    room = addPlayer(room, { userId: "p3", displayName: "Bob" });

    room = {
      ...room,
      players: {
        ...room.players,
        p1: { ...room.players["p1"]!, score: 100 },
        p2: { ...room.players["p2"]!, score: 300 },
        p3: { ...room.players["p3"]!, score: 100 },
      },
    };

    const board = scoreboard(room);
    expect(board.map((e) => e.userId)).toEqual(["p2", "p3", "p1"]); // p2 (300) first, then p3/p1 tie broken alphabetically
  });
});
