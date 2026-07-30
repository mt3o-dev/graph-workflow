import { describe, test, expect } from "bun:test";
import {
  addPlayer,
  advancePhase,
  answeredCount,
  assignPlayerTeam,
  computeMissedQuestionsForPlayer,
  configureTeams,
  correctAnswererCount,
  createRoomState,
  generateRoomCode,
  isAnswerCorrect,
  isLiveEligibleType,
  isValidRoomCode,
  recordAnswer,
  scoreAnswer,
  scoreboard,
  teamScoreboard,
  toPublicQuestion,
  BASE_POINTS,
  MAX_SPEED_BONUS,
  QUESTION_TIME_LIMIT_MS,
  SLOW_ANSWER_THRESHOLD_RATIO,
  type LiveQuestion,
  type RoomState,
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
    // 5 chars from a 31-char alphabet = 31^5 ≈ 28.6M possible codes. At
    // n=3000 draws the birthday-collision probability is ~14% — a real test
    // flake this project's slice-12 review actually hit, not a hypothetical.
    // Two independent mitigations instead of just picking "a bigger n" (that
    // only lowers, never eliminates, the flake probability): draw fewer
    // codes (n=300 → ~0.16% collision chance) AND tolerate at most one
    // collision rather than demanding perfect uniqueness — room codes are
    // deliberately not a security boundary (see generateRoomCode's own
    // header comment / docs/ADR-live-transport.md), a rare collision is a
    // theoretical annoyance (two rooms briefly sharing a joinable code), not
    // a correctness bug worth a flaky assertion.
    const n = 300;
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) seen.add(generateRoomCode());
    expect(seen.size).toBeGreaterThanOrEqual(n - 1);
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

// Slice 12: team grouping, team scoring, team leaderboard. Host-only
// enforcement lives at the usecase layer (see
// tests/liveQuizUsecases.test.ts's "teams (host-only)" describe block) —
// these tests cover the pure domain transitions only.
describe("teams (slice 12)", () => {
  const identityShuffle = <T>(items: readonly T[]): T[] => [...items];

  function roomWithPlayers(count: number): RoomState {
    let room = createRoomState({ code: "ABCDE", hostId: "host-1", setId: "set-1", questions: [mcQuestion] });
    for (let i = 1; i <= count; i++) {
      room = addPlayer(room, { userId: `p${i}`, displayName: `Player ${i}` });
    }
    return room;
  }

  test("a fresh room has no teams configured (individual-only, matches slice 11)", () => {
    const room = roomWithPlayers(3);
    expect(room.teamIds).toEqual([]);
    expect(Object.values(room.players).every((p) => p.teamId === null)).toBe(true);
    expect(teamScoreboard(room)).toEqual([]);
  });

  test("configureTeams auto-splits joined players evenly (7 players into 3 teams, deterministic shuffle)", () => {
    const room = configureTeams(roomWithPlayers(7), 3, identityShuffle);
    expect(room.teamIds).toEqual(["team-1", "team-2", "team-3"]);

    const counts = room.teamIds.map((teamId) => Object.values(room.players).filter((p) => p.teamId === teamId).length);
    // Round-robin over 7 players / 3 teams: sizes 3/2/2, every team non-empty.
    expect(counts.sort()).toEqual([2, 2, 3]);
    expect(counts.every((c) => c > 0)).toBe(true);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(7);
  });

  test("more teams than players is allowed and CAN produce an empty team (documented edge case)", () => {
    const room = configureTeams(roomWithPlayers(2), 5, identityShuffle);
    expect(room.teamIds).toHaveLength(5);
    const counts = room.teamIds.map((teamId) => Object.values(room.players).filter((p) => p.teamId === teamId).length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2);
    expect(counts.filter((c) => c === 0).length).toBeGreaterThan(0);
  });

  test("configureTeams rejects a non-positive/non-integer team count", () => {
    const room = roomWithPlayers(3);
    expect(() => configureTeams(room, 0)).toThrow(ValidationError);
    expect(() => configureTeams(room, -1)).toThrow(ValidationError);
    expect(() => configureTeams(room, 1.5)).toThrow(ValidationError);
  });

  test("configureTeams can only run during the lobby phase", () => {
    let room = roomWithPlayers(3);
    room = advancePhase(room, new Date()); // -> question-live
    expect(() => configureTeams(room, 2, identityShuffle)).toThrow(ValidationError);
  });

  test("re-running configureTeams reshuffles/rebalances (replaces the previous assignment)", () => {
    let room = configureTeams(roomWithPlayers(6), 2, identityShuffle);
    const firstAssignment = Object.fromEntries(Object.values(room.players).map((p) => [p.userId, p.teamId]));

    // Reverse the shuffle order this time -> different assignment.
    room = configureTeams(room, 2, (items) => [...items].reverse());
    const secondAssignment = Object.fromEntries(Object.values(room.players).map((p) => [p.userId, p.teamId]));

    expect(secondAssignment).not.toEqual(firstAssignment);
    expect(room.teamIds).toEqual(["team-1", "team-2"]);
  });

  test("assignPlayerTeam manually moves one player, rejects an unknown team, requires lobby phase", () => {
    let room = configureTeams(roomWithPlayers(2), 2, identityShuffle);
    room = assignPlayerTeam(room, "p1", "team-2");
    expect(room.players["p1"]?.teamId).toBe("team-2");

    room = assignPlayerTeam(room, "p1", null); // unassign
    expect(room.players["p1"]?.teamId).toBeNull();

    expect(() => assignPlayerTeam(room, "p1", "team-nope")).toThrow(ValidationError);
    expect(() => assignPlayerTeam(room, "ghost", "team-1")).toThrow(NotFoundError);

    const inQuestion = advancePhase(room, new Date());
    expect(() => assignPlayerTeam(inQuestion, "p1", "team-1")).toThrow(ValidationError);
  });

  test("teamScoreboard sums each team's members' scores (concrete fixture) and is sorted highest-first", () => {
    let room = configureTeams(roomWithPlayers(4), 2, identityShuffle);
    // identity shuffle over p1..p4 into 2 teams: p1,p3 -> team-1; p2,p4 -> team-2.
    room = {
      ...room,
      players: {
        ...room.players,
        p1: { ...room.players["p1"]!, score: 300 },
        p2: { ...room.players["p2"]!, score: 100 },
        p3: { ...room.players["p3"]!, score: 200 },
        p4: { ...room.players["p4"]!, score: 50 },
      },
    };

    const board = teamScoreboard(room);
    expect(board).toEqual([
      { teamId: "team-1", score: 500, playerCount: 2 }, // 300 + 200, sum not average
      { teamId: "team-2", score: 150, playerCount: 2 }, // 100 + 50
    ]);
  });

  test("individual scoring and the individual scoreboard are completely unaffected by team mode (regression)", () => {
    let room = configureTeams(roomWithPlayers(2), 2, identityShuffle);
    room = advancePhase(room, new Date("2026-01-01T00:00:00.000Z")); // question-live

    const { room: afterAnswer, result } = recordAnswer(room, "p1", mcQuestion.cardId, "1", new Date("2026-01-01T00:00:01.000Z"));
    expect(result.correct).toBe(true);
    expect(afterAnswer.players["p1"]?.score).toBe(result.points);

    // Same scoring formula, same scoreboard shape/order as the no-teams case.
    const board = scoreboard(afterAnswer);
    expect(board[0]!.userId).toBe("p1");
    expect(board[0]!.score).toBe(result.points);
  });
});

// Slice 13 (host screen): the two read-only derivations the host-screen's
// "waiting for answers" bar and reveal fragment need — both are pure
// projections of RoomState.players' existing per-answer records (no new
// stored state), fixture-tested here per the roadmap's explicit testing
// callout for "an easy fixture-based test".
describe("host screen derived counts (slice 13)", () => {
  function fourPlayerRoomInQuestion(): RoomState {
    let room = createRoomState({ code: "ABCDE", hostId: "host-1", setId: "set-1", questions: [mcQuestion] });
    for (const id of ["p1", "p2", "p3", "p4"]) {
      room = addPlayer(room, { userId: id, displayName: id });
    }
    return advancePhase(room, new Date("2026-01-01T00:00:00.000Z"));
  }

  test("answeredCount: 0 of N before anyone answers, then increments per submission, without leaking who/correctness", () => {
    let room = fourPlayerRoomInQuestion();
    expect(answeredCount(room)).toEqual({ answered: 0, total: 4 });

    ({ room } = recordAnswer(room, "p1", mcQuestion.cardId, "1", new Date("2026-01-01T00:00:01.000Z"))); // correct
    expect(answeredCount(room)).toEqual({ answered: 1, total: 4 });

    ({ room } = recordAnswer(room, "p2", mcQuestion.cardId, "0", new Date("2026-01-01T00:00:02.000Z"))); // wrong
    expect(answeredCount(room)).toEqual({ answered: 2, total: 4 }); // count doesn't distinguish correct/incorrect

    ({ room } = recordAnswer(room, "p3", mcQuestion.cardId, "1", new Date("2026-01-01T00:00:03.000Z")));
    ({ room } = recordAnswer(room, "p4", mcQuestion.cardId, "1", new Date("2026-01-01T00:00:04.000Z")));
    expect(answeredCount(room)).toEqual({ answered: 4, total: 4 });
  });

  test("answeredCount defaults to {0, total} outside question-live (e.g. still in lobby)", () => {
    let room = createRoomState({ code: "ABCDE", hostId: "host-1", setId: "set-1", questions: [mcQuestion] });
    room = addPlayer(room, { userId: "p1", displayName: "p1" });
    expect(answeredCount(room)).toEqual({ answered: 0, total: 1 });
  });

  test("correctAnswererCount only counts players who actually got it right", () => {
    let room = fourPlayerRoomInQuestion();
    expect(correctAnswererCount(room)).toBe(0);

    ({ room } = recordAnswer(room, "p1", mcQuestion.cardId, "1", new Date("2026-01-01T00:00:01.000Z"))); // correct (option index 1)
    ({ room } = recordAnswer(room, "p2", mcQuestion.cardId, "0", new Date("2026-01-01T00:00:02.000Z"))); // wrong
    ({ room } = recordAnswer(room, "p3", mcQuestion.cardId, "1", new Date("2026-01-01T00:00:03.000Z"))); // correct

    expect(correctAnswererCount(room)).toBe(2);
    expect(answeredCount(room)).toEqual({ answered: 3, total: 4 }); // regression: unaffected by correctness
  });
});

// Slice 15 (live-quiz post-game review import): pure "what should be
// scheduled into this player's real review queue" detection. The impure
// clone+seed side effects are covered separately in
// tests/liveQuizPostGameReview.test.ts — this only exercises the domain fn.
describe("computeMissedQuestionsForPlayer (slice 15)", () => {
  const unansweredQuestion: LiveQuestion = {
    cardId: "card-unanswered",
    type: "multiple_choice",
    payload: { question: "1+1?", options: ["1", "2"], correctIndex: 1 },
  };

  function playThroughFourQuestions(): RoomState {
    let room = createRoomState({
      code: "ABCDE",
      hostId: "host-1",
      setId: "set-1",
      questions: [mcQuestion, tfQuestion, taQuestion, unansweredQuestion],
    });
    room = addPlayer(room, { userId: "p1", displayName: "Alice" });

    // Q0 (mc): answered WRONG.
    room = advancePhase(room, new Date("2026-01-01T00:00:00.000Z"));
    ({ room } = recordAnswer(room, "p1", mcQuestion.cardId, "0", new Date("2026-01-01T00:00:01.000Z")));
    room = advancePhase(room, new Date("2026-01-01T00:00:05.000Z")); // -> reveal

    // Q1 (tf): answered CORRECT and FAST (1s in, well under the 14s slow cutoff).
    room = advancePhase(room, new Date("2026-01-01T00:01:00.000Z")); // -> question-live, started at :01:00
    ({ room } = recordAnswer(room, "p1", tfQuestion.cardId, "true", new Date("2026-01-01T00:01:01.000Z")));
    room = advancePhase(room, new Date("2026-01-01T00:01:05.000Z")); // -> reveal

    // Q2 (ta): answered CORRECT but SLOW (15s in, past the 14s/70% cutoff).
    room = advancePhase(room, new Date("2026-01-01T00:02:00.000Z")); // -> question-live, started at :02:00
    ({ room } = recordAnswer(room, "p1", taQuestion.cardId, "Paris", new Date("2026-01-01T00:02:15.000Z")));
    room = advancePhase(room, new Date("2026-01-01T00:02:16.000Z")); // -> reveal

    // Q3 (unanswered): never answered at all.
    room = advancePhase(room, new Date("2026-01-01T00:03:00.000Z")); // -> question-live
    room = advancePhase(room, new Date("2026-01-01T00:03:20.000Z")); // -> reveal (timed out)
    room = advancePhase(room, new Date("2026-01-01T00:03:21.000Z")); // -> finished

    return room;
  }

  test("wrong = missed, correct-but-slow past the threshold = missed, correct-and-fast = NOT missed, never-answered = missed", () => {
    const room = playThroughFourQuestions();
    const missed = computeMissedQuestionsForPlayer(room, "p1");

    expect(missed.map((m) => m.cardId).sort()).toEqual(
      [mcQuestion.cardId, taQuestion.cardId, unansweredQuestion.cardId].sort(),
    );
    expect(missed.find((m) => m.cardId === mcQuestion.cardId)?.reason).toBe("wrong");
    expect(missed.find((m) => m.cardId === taQuestion.cardId)?.reason).toBe("slow");
    expect(missed.find((m) => m.cardId === unansweredQuestion.cardId)?.reason).toBe("unanswered");
    // The fast-and-correct answer must NOT appear at all.
    expect(missed.some((m) => m.cardId === tfQuestion.cardId)).toBe(false);
  });

  test("the slow-threshold boundary: exactly at the ratio is NOT slow, one ms past it IS", () => {
    let room = createRoomState({ code: "ABCDE", hostId: "host-1", setId: "set-1", questions: [taQuestion] });
    room = addPlayer(room, { userId: "p1", displayName: "Alice" });
    const start = new Date("2026-01-01T00:00:00.000Z");
    room = advancePhase(room, start);

    const cutoffMs = SLOW_ANSWER_THRESHOLD_RATIO * QUESTION_TIME_LIMIT_MS;

    const atCutoff = recordAnswer(room, "p1", taQuestion.cardId, "Paris", new Date(start.getTime() + cutoffMs)).room;
    expect(computeMissedQuestionsForPlayer(atCutoff, "p1")).toEqual([]);

    const pastCutoff = recordAnswer(room, "p1", taQuestion.cardId, "Paris", new Date(start.getTime() + cutoffMs + 1)).room;
    expect(computeMissedQuestionsForPlayer(pastCutoff, "p1")).toEqual([{ cardId: taQuestion.cardId, reason: "slow" }]);
  });

  test("returns [] for a userId that never joined the room", () => {
    const room = playThroughFourQuestions();
    expect(computeMissedQuestionsForPlayer(room, "never-joined")).toEqual([]);
  });

  test("defensively treats a correct answer as NOT slow if no timing history exists for that question index (hand-built fixture)", () => {
    let room = createRoomState({ code: "ABCDE", hostId: "host-1", setId: "set-1", questions: [taQuestion] });
    room = addPlayer(room, { userId: "p1", displayName: "Alice" });
    room = advancePhase(room, new Date("2026-01-01T00:00:00.000Z"));
    ({ room } = recordAnswer(room, "p1", taQuestion.cardId, "Paris", new Date("2026-01-01T01:00:00.000Z"))); // absurdly "slow" by elapsed time alone

    // Strip the timing history a hand-built fixture might omit — no crash, no false "slow".
    const roomWithoutHistory: RoomState = { ...room, questionStartedAtMsHistory: {} };
    expect(computeMissedQuestionsForPlayer(roomWithoutHistory, "p1")).toEqual([]);
  });
});
