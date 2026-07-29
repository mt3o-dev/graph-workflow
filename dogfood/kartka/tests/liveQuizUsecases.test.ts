import { describe, test, expect, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { unlinkSync } from "node:fs";
import * as schema from "../src/adapters/db/schema.sqlite";
import { migrateSqlite } from "../src/adapters/db/migrateSqlite";
import { createSetRepoSqlite } from "../src/adapters/db/setRepo.sqlite";
import { createCardRepoSqlite } from "../src/adapters/db/cardRepo.sqlite";
import { createUserRepoSqlite } from "../src/adapters/db/userRepo.sqlite";
import { createSet } from "../src/core/usecases/setUsecases";
import { addCard } from "../src/core/usecases/cardUsecases";
import {
  createLiveSession,
  joinLiveSession,
  submitLiveAnswer,
  advanceLiveQuestion,
  computeScoreboard,
  getLiveRoom,
  setLiveTeams,
  assignLiveTeam,
  computeTeamScoreboard,
} from "../src/core/usecases/liveQuizUsecases";
import { createInMemoryLiveSessionPort } from "../src/adapters/liveQuiz/inMemoryLiveSessionPort";
import type { LiveSessionPort } from "../src/core/ports/liveSessionPort";
import { ForbiddenError, NotFoundError, ValidationError } from "../src/core/domain/errors";

// This suite tests core/usecases/liveQuizUsecases.ts — orchestration only,
// with ZERO network/socket code exercised anywhere here. The LiveSessionPort
// is the real in-memory adapter (network-free by construction, it's a plain
// Map), and Set/Card ownership is checked against real sqlite repos so the
// ownership-bug class this project cares about most is genuinely covered.
// See docs/ADR-live-transport.md and the slice 11 report for what this DOES
// NOT cover (the actual WebSocket wire protocol, multi-client scenarios).

const dbPath = `./data/test-live-quiz-${crypto.randomUUID()}.db`;
const sqlite = new Database(dbPath, { create: true });
const db = drizzle(sqlite, { schema });
await migrateSqlite(db as never);

const setRepo = createSetRepoSqlite(db as never);
const cardRepo = createCardRepoSqlite(db as never);
const userRepo = createUserRepoSqlite(db as never);

afterAll(() => {
  sqlite.close();
  try {
    unlinkSync(dbPath);
    unlinkSync(`${dbPath}-shm`);
    unlinkSync(`${dbPath}-wal`);
  } catch {
    // best-effort cleanup
  }
});

async function makeUser(email: string) {
  return userRepo.create({ email, passwordHash: "h", displayName: email.split("@")[0]! });
}

async function makeMixedSet(ownerId: string) {
  const set = await createSet(setRepo, { ownerId, title: "Live-eligible mix" });
  const mc = await addCard(cardRepo, setRepo, {
    setId: set.id,
    ownerId,
    type: "multiple_choice",
    payload: { question: "2+2?", options: ["3", "4", "5"], correctIndex: 1 },
  });
  const tf = await addCard(cardRepo, setRepo, {
    setId: set.id,
    ownerId,
    type: "true_false",
    payload: { statement: "Sky is blue", isTrue: true },
  });
  const ta = await addCard(cardRepo, setRepo, {
    setId: set.id,
    ownerId,
    type: "type_answer",
    payload: { prompt: "Capital of France?", acceptedAnswers: ["Paris"] },
  });
  // Non-eligible types, included to prove they're excluded from the pool.
  await addCard(cardRepo, setRepo, { setId: set.id, ownerId, type: "basic", payload: { front: "f", back: "b" } });
  await addCard(cardRepo, setRepo, { setId: set.id, ownerId, type: "cloze", payload: { text: "{{c1::x}}" } });
  await addCard(cardRepo, setRepo, {
    setId: set.id,
    ownerId,
    type: "image_occlusion",
    payload: { imageUrl: "http://x/i.png", regions: [{ x: 0, y: 0, w: 10, h: 10, label: "l" }] },
  });
  return { set, mc, tf, ta };
}

describe("createLiveSession", () => {
  test("owner can start a live session; only eligible card types become questions", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser("live-owner1@example.com");
    const { set } = await makeMixedSet(owner.id);

    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    expect(room.hostId).toBe(owner.id);
    expect(room.setId).toBe(set.id);
    expect(room.questions).toHaveLength(3);
    expect(room.questions.map((q) => q.type).sort()).toEqual(["multiple_choice", "true_false", "type_answer"]);
    expect(room.phase).toBe("lobby");
  });

  test("a non-owner cannot start a live session from someone else's set", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser("live-owner2@example.com");
    const intruder = await makeUser("live-intruder2@example.com");
    const { set } = await makeMixedSet(owner.id);

    await expect(createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: intruder.id })).rejects.toThrow(ForbiddenError);
  });

  test("an unknown setId 404s", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser("live-owner3@example.com");
    await expect(createLiveSession(port, setRepo, cardRepo, { setId: "nope", hostId: owner.id })).rejects.toThrow(NotFoundError);
  });

  test("a set with no live-eligible cards is rejected", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser("live-owner4@example.com");
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Only basics" });
    await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f", back: "b" } });

    await expect(createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id })).rejects.toThrow(ValidationError);
  });

  test("each session gets a fresh, valid room code", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser("live-owner5@example.com");
    const { set } = await makeMixedSet(owner.id);

    const roomA = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    const roomB = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    expect(roomA.code).not.toBe(roomB.code);
  });
});

describe("joinLiveSession", () => {
  async function setupRoom(): Promise<{ port: LiveSessionPort; code: string; hostId: string }> {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`join-owner-${crypto.randomUUID()}@example.com`);
    const { set } = await makeMixedSet(owner.id);
    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    return { port, code: room.code, hostId: owner.id };
  }

  test("a valid code lets any logged-in user join, no ownership required", async () => {
    const { port, code } = await setupRoom();
    const player = await makeUser("live-player1@example.com");
    const room = await joinLiveSession(port, { code, userId: player.id, displayName: player.displayName });
    expect(room.players[player.id]).toBeDefined();
    expect(room.players[player.id]?.score).toBe(0);
  });

  test("an unknown/invalid code fails cleanly", async () => {
    const port = createInMemoryLiveSessionPort();
    const player = await makeUser("live-player2@example.com");
    await expect(joinLiveSession(port, { code: "ZZZZZ", userId: player.id, displayName: "P" })).rejects.toThrow(NotFoundError);
  });

  test("the host itself can join its own room (to play along / test)", async () => {
    const { port, code, hostId } = await setupRoom();
    const room = await joinLiveSession(port, { code, userId: hostId, displayName: "Host" });
    expect(room.players[hostId]).toBeDefined();
  });
});

describe("submitLiveAnswer + scoring, all three auto-scorable types", () => {
  test("multiple_choice scores correctly", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`mc-owner-${crypto.randomUUID()}@example.com`);
    const { set, mc } = await makeMixedSet(owner.id);
    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    const player = await makeUser(`mc-player-${crypto.randomUUID()}@example.com`);
    await joinLiveSession(port, { code: room.code, userId: player.id, displayName: player.displayName });
    await advanceLiveQuestion(port, { code: room.code, hostId: owner.id }); // -> question-live, index 0 (mc, per insertion order)

    const { result } = await submitLiveAnswer(port, { code: room.code, userId: player.id, cardId: mc.id, rawAnswer: "1" });
    expect(result.correct).toBe(true);
    expect(result.points).toBeGreaterThan(0);

    const wrongPlayer = await makeUser(`mc-player2-${crypto.randomUUID()}@example.com`);
    await joinLiveSession(port, { code: room.code, userId: wrongPlayer.id, displayName: wrongPlayer.displayName });
    const { result: wrongResult } = await submitLiveAnswer(port, {
      code: room.code,
      userId: wrongPlayer.id,
      cardId: mc.id,
      rawAnswer: "0",
    });
    expect(wrongResult.correct).toBe(false);
    expect(wrongResult.points).toBe(0);
  });

  test("true_false and type_answer score correctly", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`tfta-owner-${crypto.randomUUID()}@example.com`);
    const { set, tf, ta } = await makeMixedSet(owner.id);
    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    const player = await makeUser(`tfta-player-${crypto.randomUUID()}@example.com`);
    await joinLiveSession(port, { code: room.code, userId: player.id, displayName: player.displayName });

    // Advance through mc (index 0: question-live -> reveal) to reach tf (index 1).
    await advanceLiveQuestion(port, { code: room.code, hostId: owner.id }); // mc question-live
    await advanceLiveQuestion(port, { code: room.code, hostId: owner.id }); // mc reveal
    await advanceLiveQuestion(port, { code: room.code, hostId: owner.id }); // tf question-live

    const { result: tfResult } = await submitLiveAnswer(port, { code: room.code, userId: player.id, cardId: tf.id, rawAnswer: "true" });
    expect(tfResult.correct).toBe(true);

    await advanceLiveQuestion(port, { code: room.code, hostId: owner.id }); // tf reveal
    await advanceLiveQuestion(port, { code: room.code, hostId: owner.id }); // ta question-live

    const { result: taResult } = await submitLiveAnswer(port, {
      code: room.code,
      userId: player.id,
      cardId: ta.id,
      rawAnswer: "paris", // case-insensitive fuzzy match, reuses levenshtein.ts
    });
    expect(taResult.correct).toBe(true);
  });

  test("a player who hasn't joined cannot submit an answer", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`nojoin-owner-${crypto.randomUUID()}@example.com`);
    const { set, mc } = await makeMixedSet(owner.id);
    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    await advanceLiveQuestion(port, { code: room.code, hostId: owner.id });

    const stranger = await makeUser(`stranger-${crypto.randomUUID()}@example.com`);
    await expect(
      submitLiveAnswer(port, { code: room.code, userId: stranger.id, cardId: mc.id, rawAnswer: "1" }),
    ).rejects.toThrow(ForbiddenError);
  });

  test("submitting to an unknown room code fails cleanly", async () => {
    const port = createInMemoryLiveSessionPort();
    const someone = await makeUser(`unknown-room-${crypto.randomUUID()}@example.com`);
    await expect(
      submitLiveAnswer(port, { code: "ZZZZZ", userId: someone.id, cardId: "whatever", rawAnswer: "1" }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("advanceLiveQuestion (host-only)", () => {
  test("only the host can advance the question", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`advance-owner-${crypto.randomUUID()}@example.com`);
    const { set } = await makeMixedSet(owner.id);
    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    const player = await makeUser(`advance-player-${crypto.randomUUID()}@example.com`);
    await joinLiveSession(port, { code: room.code, userId: player.id, displayName: player.displayName });

    await expect(advanceLiveQuestion(port, { code: room.code, hostId: player.id })).rejects.toThrow(ForbiddenError);

    const advanced = await advanceLiveQuestion(port, { code: room.code, hostId: owner.id });
    expect(advanced.phase).toBe("question-live");
  });

  test("question sequencing walks through every eligible question then finishes", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`sequence-owner-${crypto.randomUUID()}@example.com`);
    const { set } = await makeMixedSet(owner.id);
    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });

    const phases: string[] = [];
    let current = room;
    for (let i = 0; i < 8; i++) {
      current = await advanceLiveQuestion(port, { code: room.code, hostId: owner.id });
      phases.push(current.phase);
      if (current.phase === "finished") break;
    }
    expect(phases[phases.length - 1]).toBe("finished");
    // 3 eligible questions -> 6 live/reveal transitions then finished.
    expect(phases).toEqual([
      "question-live",
      "reveal",
      "question-live",
      "reveal",
      "question-live",
      "reveal",
      "finished",
    ]);
  });
});

describe("computeScoreboard", () => {
  test("orders players by score after several answers", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`score-owner-${crypto.randomUUID()}@example.com`);
    const { set, mc } = await makeMixedSet(owner.id);
    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });

    const fast = await makeUser(`score-fast-${crypto.randomUUID()}@example.com`);
    const slow = await makeUser(`score-slow-${crypto.randomUUID()}@example.com`);
    const wrong = await makeUser(`score-wrong-${crypto.randomUUID()}@example.com`);
    await joinLiveSession(port, { code: room.code, userId: fast.id, displayName: "Fast" });
    await joinLiveSession(port, { code: room.code, userId: slow.id, displayName: "Slow" });
    await joinLiveSession(port, { code: room.code, userId: wrong.id, displayName: "Wrong" });

    const start = new Date("2026-01-01T00:00:00.000Z");
    await advanceLiveQuestion(port, { code: room.code, hostId: owner.id, now: start });

    await submitLiveAnswer(port, { code: room.code, userId: fast.id, cardId: mc.id, rawAnswer: "1", now: new Date(start.getTime() + 100) });
    await submitLiveAnswer(port, {
      code: room.code,
      userId: slow.id,
      cardId: mc.id,
      rawAnswer: "1",
      now: new Date(start.getTime() + 19000),
    });
    await submitLiveAnswer(port, { code: room.code, userId: wrong.id, cardId: mc.id, rawAnswer: "0", now: new Date(start.getTime() + 100) });

    const board = await computeScoreboard(port, room.code);
    expect(board.map((e) => e.userId)).toEqual([fast.id, slow.id, wrong.id]);
    expect(board[0]!.score).toBeGreaterThan(board[1]!.score);
    expect(board[2]!.score).toBe(0);
  });

  test("an unknown room code 404s", async () => {
    const port = createInMemoryLiveSessionPort();
    await expect(computeScoreboard(port, "ZZZZZ")).rejects.toThrow(NotFoundError);
  });
});

// Slice 12: team usecases. Pure domain assignment/aggregation math is
// covered in tests/liveQuiz.test.ts; this describe block is specifically
// about the host-only enforcement pattern (transport-independent — no
// socket involved, matching every other usecase test in this file) plus
// the port wiring for the new methods.
describe("teams (host-only)", () => {
  async function setupRoomWithPlayers(playerCount: number) {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`teams-owner-${crypto.randomUUID()}@example.com`);
    const { set } = await makeMixedSet(owner.id);
    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    const players = [];
    for (let i = 0; i < playerCount; i++) {
      const p = await makeUser(`teams-player-${i}-${crypto.randomUUID()}@example.com`);
      await joinLiveSession(port, { code: room.code, userId: p.id, displayName: p.displayName });
      players.push(p);
    }
    return { port, code: room.code, hostId: owner.id, players };
  }

  test("only the host can configure teams", async () => {
    const { port, code, hostId, players } = await setupRoomWithPlayers(4);
    await expect(setLiveTeams(port, { code, hostId: players[0]!.id, teamCount: 2 })).rejects.toThrow(ForbiddenError);

    const room = await setLiveTeams(port, { code, hostId, teamCount: 2 });
    expect(room.teamIds).toEqual(["team-1", "team-2"]);
    expect(Object.values(room.players).every((p) => p.teamId !== null)).toBe(true);
  });

  test("only the host can manually reassign a player's team", async () => {
    const { port, code, hostId, players } = await setupRoomWithPlayers(3);
    await setLiveTeams(port, { code, hostId, teamCount: 2 });

    await expect(
      assignLiveTeam(port, { code, hostId: players[0]!.id, userId: players[0]!.id, teamId: "team-1" }),
    ).rejects.toThrow(ForbiddenError);

    const room = await assignLiveTeam(port, { code, hostId, userId: players[0]!.id, teamId: "team-1" });
    expect(room.players[players[0]!.id]?.teamId).toBe("team-1");
  });

  test("configuring teams on an unknown room code fails cleanly", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`teams-unknown-${crypto.randomUUID()}@example.com`);
    await expect(setLiveTeams(port, { code: "ZZZZZ", hostId: owner.id, teamCount: 2 })).rejects.toThrow(NotFoundError);
  });

  test("computeTeamScoreboard returns [] before teams are configured, and aggregated sums after (via the port)", async () => {
    const { port, code, hostId, players } = await setupRoomWithPlayers(2);
    expect(await computeTeamScoreboard(port, code)).toEqual([]);

    await setLiveTeams(port, { code, hostId, teamCount: 2 });
    await advanceLiveQuestion(port, { code, hostId }); // -> question-live

    const room = await getLiveRoom(port, code);
    const q = room.questions[0]!;
    await submitLiveAnswer(port, { code, userId: players[0]!.id, cardId: q.cardId, rawAnswer: "1" });

    const teamBoard = await computeTeamScoreboard(port, code);
    expect(teamBoard.reduce((sum, t) => sum + t.playerCount, 0)).toBe(2);
    const totalTeamScore = teamBoard.reduce((sum, t) => sum + t.score, 0);
    const individualBoard = await computeScoreboard(port, code);
    const totalIndividualScore = individualBoard.reduce((sum, e) => sum + e.score, 0);
    // Sum-based team aggregation: total across all teams equals total across all players.
    expect(totalTeamScore).toBe(totalIndividualScore);
  });

  test("individual scoreboard/scoring is unaffected by team mode being configured (regression, through the port)", async () => {
    const { port, code, hostId, players } = await setupRoomWithPlayers(2);
    await setLiveTeams(port, { code, hostId, teamCount: 2 });
    await advanceLiveQuestion(port, { code, hostId });
    const room = await getLiveRoom(port, code);
    const q = room.questions[0]!;

    const { result } = await submitLiveAnswer(port, { code, userId: players[0]!.id, cardId: q.cardId, rawAnswer: "1" });
    expect(result.correct).toBe(true);

    const board = await computeScoreboard(port, code);
    expect(board.find((e) => e.userId === players[0]!.id)?.score).toBe(result.points);
  });
});

describe("getLiveRoom", () => {
  test("returns the room for a valid code, 404s otherwise", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`getroom-owner-${crypto.randomUUID()}@example.com`);
    const { set } = await makeMixedSet(owner.id);
    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });

    const fetched = await getLiveRoom(port, room.code);
    expect(fetched.code).toBe(room.code);
    await expect(getLiveRoom(port, "ZZZZZ")).rejects.toThrow(NotFoundError);
  });
});
