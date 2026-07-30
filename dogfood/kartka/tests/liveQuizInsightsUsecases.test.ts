import { describe, test, expect, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { unlinkSync } from "node:fs";
import * as schema from "../src/adapters/db/schema.sqlite";
import { migrateSqlite } from "../src/adapters/db/migrateSqlite";
import { createSetRepoSqlite } from "../src/adapters/db/setRepo.sqlite";
import { createCardRepoSqlite } from "../src/adapters/db/cardRepo.sqlite";
import { createUserRepoSqlite } from "../src/adapters/db/userRepo.sqlite";
import { createLiveQuizInsightsRepoSqlite } from "../src/adapters/db/liveQuizInsightsRepo.sqlite";
import { createSet } from "../src/core/usecases/setUsecases";
import { addCard } from "../src/core/usecases/cardUsecases";
import { createInMemoryLiveSessionPort } from "../src/adapters/liveQuiz/inMemoryLiveSessionPort";
import { createLiveSession, joinLiveSession, advanceLiveQuestion, submitLiveAnswer } from "../src/core/usecases/liveQuizUsecases";
import { recordLiveQuizRoundInsights, getSetInsights } from "../src/core/usecases/liveQuizInsightsUsecases";
import { ValidationError, NotFoundError, ForbiddenError } from "../src/core/domain/errors";

// Slice 16 (teacher insights) end-to-end coverage: the finished-round write
// path (correctness + the exact concurrent-render duplicate-write race class
// slice 15's review found, now guarded from the start), the aggregate
// read-side math across multiple historical rounds, anonymized student
// labeling, and ownership. tests/liveQuizInsights.test.ts covers the pure
// aggregateQuestionStats/aggregateStudentStats functions in isolation.

const dbPath = `./data/test-insights-${crypto.randomUUID()}.db`;
const sqlite = new Database(dbPath, { create: true });
const db = drizzle(sqlite, { schema });
await migrateSqlite(db as never);

const setRepo = createSetRepoSqlite(db as never);
const cardRepo = createCardRepoSqlite(db as never);
const userRepo = createUserRepoSqlite(db as never);
const insightsRepo = createLiveQuizInsightsRepoSqlite(db as never);

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

/** Two multiple_choice cards, correct option always at index 1 — mirrors tests/liveQuizPostGameReview.test.ts's fixture shape. */
async function makeTwoMcCardSet(ownerId: string) {
  const set = await createSet(setRepo, { ownerId, title: "Insights source set" });
  const cardA = await addCard(cardRepo, setRepo, {
    setId: set.id,
    ownerId,
    type: "multiple_choice",
    payload: { question: "Q-A", options: ["wrong-a", "right", "wrong-b"], correctIndex: 1 },
  });
  const cardB = await addCard(cardRepo, setRepo, {
    setId: set.id,
    ownerId,
    type: "multiple_choice",
    payload: { question: "Q-B", options: ["wrong-a", "right", "wrong-b"], correctIndex: 1 },
  });
  return { set, cardA, cardB };
}

/** Plays a full round: player answers cardA correctly, cardB WRONG. Advances the room to "finished". Returns the room code. */
async function playRound(
  port: ReturnType<typeof createInMemoryLiveSessionPort>,
  setId: string,
  hostId: string,
  playerId: string,
  cardAId: string,
  cardBId: string,
  start: Date,
): Promise<string> {
  const created = await createLiveSession(port, setRepo, cardRepo, { setId, hostId });
  await joinLiveSession(port, { code: created.code, userId: playerId, displayName: "Player" });

  await advanceLiveQuestion(port, { code: created.code, hostId, now: start }); // q0 live
  await submitLiveAnswer(port, { code: created.code, userId: playerId, cardId: cardAId, rawAnswer: "1", now: new Date(start.getTime() + 1000) }); // correct
  await advanceLiveQuestion(port, { code: created.code, hostId, now: new Date(start.getTime() + 5000) }); // reveal
  await advanceLiveQuestion(port, { code: created.code, hostId, now: new Date(start.getTime() + 6000) }); // q1 live
  await submitLiveAnswer(port, { code: created.code, userId: playerId, cardId: cardBId, rawAnswer: "0", now: new Date(start.getTime() + 6500) }); // wrong
  await advanceLiveQuestion(port, { code: created.code, hostId, now: new Date(start.getTime() + 10_000) }); // reveal
  await advanceLiveQuestion(port, { code: created.code, hostId, now: new Date(start.getTime() + 11_000) }); // -> finished

  return created.code;
}

describe("recordLiveQuizRoundInsights", () => {
  test("only runs on a finished room — throws ValidationError otherwise", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`notfinished-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`notfinished-player-${crypto.randomUUID()}@example.com`);
    const { set } = await makeTwoMcCardSet(owner.id);
    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    await joinLiveSession(port, { code: room.code, userId: player.id, displayName: "Player" });

    await expect(recordLiveQuizRoundInsights({ liveSessionPort: port, insightsRepo }, room.code)).rejects.toThrow(ValidationError);
  });

  test("an unknown room code 404s", async () => {
    const port = createInMemoryLiveSessionPort();
    await expect(recordLiveQuizRoundInsights({ liveSessionPort: port, insightsRepo }, "ZZZZZ")).rejects.toThrow(NotFoundError);
  });

  test("writes one row per (player, question) with the RIGHT correctness flags, matching the room's actual recorded answers", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`write-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`write-player-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);
    const start = new Date("2026-03-01T00:00:00.000Z");
    const code = await playRound(port, set.id, owner.id, player.id, cardA.id, cardB.id, start);

    const now = new Date("2026-03-01T00:05:00.000Z");
    await recordLiveQuizRoundInsights({ liveSessionPort: port, insightsRepo }, code, now);

    const rows = await insightsRepo.listBySetId(set.id);
    expect(rows).toHaveLength(2); // 1 player x 2 questions

    const rowA = rows.find((r) => r.cardId === cardA.id)!;
    const rowB = rows.find((r) => r.cardId === cardB.id)!;
    expect(rowA.correct).toBe(true); // answered correctly
    expect(rowB.correct).toBe(false); // answered wrong
    for (const row of [rowA, rowB]) {
      expect(row.roomCode).toBe(code);
      expect(row.setId).toBe(set.id);
      expect(row.hostId).toBe(owner.id);
      expect(row.userId).toBe(player.id);
      expect(row.finishedAt.getTime()).toBe(now.getTime());
    }
  });

  test("a player who never answered a question still gets a row, recorded as incorrect ('asked' counts every exposure, not just answered ones)", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`unanswered-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`unanswered-player-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);
    const created = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    await joinLiveSession(port, { code: created.code, userId: player.id, displayName: "Player" });
    const start = new Date("2026-03-02T00:00:00.000Z");
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: start }); // q0 live, never answered
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 20_000) }); // reveal
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 21_000) }); // q1
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 42_000) }); // reveal
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 43_000) }); // finished

    await recordLiveQuizRoundInsights({ liveSessionPort: port, insightsRepo }, created.code);
    const rows = await insightsRepo.listBySetId(set.id);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.correct === false)).toBe(true);
    void cardA;
    void cardB;
  });

  test("concurrent calls for the same finished round never produce duplicate rows (real Promise.all race, mirroring slice 15's regression test shape)", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`race-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`race-player-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);
    const code = await playRound(port, set.id, owner.id, player.id, cardA.id, cardB.id, new Date("2026-03-03T00:00:00.000Z"));

    const deps = { liveSessionPort: port, insightsRepo };
    // Several genuinely-concurrent calls, exactly the "multiple clients each
    // rendering the finished screen" scenario live-server.ts's
    // sendCurrentRoomState triggers this from — not sequential awaits.
    await Promise.all([
      recordLiveQuizRoundInsights(deps, code),
      recordLiveQuizRoundInsights(deps, code),
      recordLiveQuizRoundInsights(deps, code),
      recordLiveQuizRoundInsights(deps, code),
      recordLiveQuizRoundInsights(deps, code),
    ]);

    const rows = await insightsRepo.listBySetId(set.id);
    // Exactly 1 player x 2 questions = 2 rows, never duplicated by the race.
    expect(rows).toHaveLength(2);
    const byCard = new Set(rows.map((r) => r.cardId));
    expect(byCard.size).toBe(2);
  });
});

describe("getSetInsights", () => {
  test("ownership: a non-owner cannot view another host's set's insights", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`owner-a-${crypto.randomUUID()}@example.com`);
    const intruder = await makeUser(`intruder-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`player-a-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);
    const code = await playRound(port, set.id, owner.id, player.id, cardA.id, cardB.id, new Date("2026-03-04T00:00:00.000Z"));
    await recordLiveQuizRoundInsights({ liveSessionPort: port, insightsRepo }, code);

    await expect(getSetInsights({ setRepo, cardRepo, insightsRepo }, set.id, intruder.id)).rejects.toThrow(ForbiddenError);
    // The real owner can, of course.
    const own = await getSetInsights({ setRepo, cardRepo, insightsRepo }, set.id, owner.id);
    expect(own.questionStats).toHaveLength(2);
  });

  test("an unknown setId 404s (re-derives ownership from setId, never trusts a caller-supplied value blindly)", async () => {
    const someone = await makeUser(`someone-${crypto.randomUUID()}@example.com`);
    await expect(getSetInsights({ setRepo, cardRepo, insightsRepo }, "nonexistent-set-id", someone.id)).rejects.toThrow(NotFoundError);
  });

  test("per-question aggregate math is correct across MULTIPLE historical rounds with a mix of correct/incorrect, weakest-first", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`math-owner-${crypto.randomUUID()}@example.com`);
    const playerX = await makeUser(`math-x-${crypto.randomUUID()}@example.com`);
    const playerY = await makeUser(`math-y-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);

    // Round 1: playerX gets cardA right, cardB wrong.
    const code1 = await playRound(port, set.id, owner.id, playerX.id, cardA.id, cardB.id, new Date("2026-04-01T00:00:00.000Z"));
    await recordLiveQuizRoundInsights({ liveSessionPort: port, insightsRepo }, code1);

    // Round 2: playerY gets cardA right, cardB wrong too.
    const code2 = await playRound(port, set.id, owner.id, playerY.id, cardA.id, cardB.id, new Date("2026-04-02T00:00:00.000Z"));
    await recordLiveQuizRoundInsights({ liveSessionPort: port, insightsRepo }, code2);

    const insights = await getSetInsights({ setRepo, cardRepo, insightsRepo }, set.id, owner.id);
    expect(insights.questionStats).toHaveLength(2);
    // cardA: 2/2 correct = 100%. cardB: 0/2 correct = 0%. Weakest (cardB) first.
    expect(insights.questionStats[0]!.cardId).toBe(cardB.id);
    expect(insights.questionStats[0]!.percentCorrect).toBe(0);
    expect(insights.questionStats[0]!.timesAsked).toBe(2);
    expect(insights.questionStats[1]!.cardId).toBe(cardA.id);
    expect(insights.questionStats[1]!.percentCorrect).toBe(100);
  });

  test("anonymized student labeling is consistent across repeated queries and never leaks a real display name", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`anon-owner-${crypto.randomUUID()}@example.com`);
    const playerX = await makeUser(`anon-x-${crypto.randomUUID()}@example.com`);
    const playerY = await makeUser(`anon-y-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);

    const code1 = await playRound(port, set.id, owner.id, playerX.id, cardA.id, cardB.id, new Date("2026-05-01T00:00:00.000Z"));
    await recordLiveQuizRoundInsights({ liveSessionPort: port, insightsRepo }, code1);
    const code2 = await playRound(port, set.id, owner.id, playerY.id, cardA.id, cardB.id, new Date("2026-05-02T00:00:00.000Z"));
    await recordLiveQuizRoundInsights({ liveSessionPort: port, insightsRepo }, code2);

    const first = await getSetInsights({ setRepo, cardRepo, insightsRepo }, set.id, owner.id);
    const second = await getSetInsights({ setRepo, cardRepo, insightsRepo }, set.id, owner.id);

    expect(first.studentStats).toHaveLength(2);
    // Consistent across repeated calls (same underlying data).
    expect(first.studentStats.map((s) => [s.userId, s.anonymizedIndex])).toEqual(
      second.studentStats.map((s) => [s.userId, s.anonymizedIndex]),
    );
    // Never exposes a display name field on the student stat shape.
    for (const s of first.studentStats) {
      expect(Object.keys(s)).not.toContain("displayName");
      expect(JSON.stringify(s)).not.toContain(playerX.displayName);
      expect(JSON.stringify(s)).not.toContain(playerY.displayName);
    }
  });

  test("anonymized ordering is deterministic even when two players finish the SAME round (identical finishedAt, the normal case, not an edge case)", async () => {
    // Regression test for a real gap the review found: every row of one
    // round shares the exact same `finishedAt` (recordLiveQuizRoundInsights
    // stamps one `now` for the whole round), so any round with 2+ players —
    // which is the headline real-world scenario for a classroom live quiz —
    // ties on the primary sort key. The fix added an `id`-based secondary
    // sort key (aggregateStudentStats) plus an explicit `ORDER BY id` in both
    // repo adapters, so the result no longer depends on incidental
    // DB/array row order. This test proves it: two players in ONE round,
    // queried repeatedly, must always agree on who is "Student 1" vs "Student 2".
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`tie-owner-${crypto.randomUUID()}@example.com`);
    const playerX = await makeUser(`tie-x-${crypto.randomUUID()}@example.com`);
    const playerY = await makeUser(`tie-y-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);

    const created = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    await joinLiveSession(port, { code: created.code, userId: playerX.id, displayName: "Player X" });
    await joinLiveSession(port, { code: created.code, userId: playerY.id, displayName: "Player Y" });
    const start = new Date("2026-06-01T00:00:00.000Z");
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: start });
    await submitLiveAnswer(port, { code: created.code, userId: playerX.id, cardId: cardA.id, rawAnswer: "1", now: new Date(start.getTime() + 1000) });
    await submitLiveAnswer(port, { code: created.code, userId: playerY.id, cardId: cardA.id, rawAnswer: "1", now: new Date(start.getTime() + 1000) });
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 5000) });
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 6000) });
    await submitLiveAnswer(port, { code: created.code, userId: playerX.id, cardId: cardB.id, rawAnswer: "0", now: new Date(start.getTime() + 6500) });
    await submitLiveAnswer(port, { code: created.code, userId: playerY.id, cardId: cardB.id, rawAnswer: "0", now: new Date(start.getTime() + 6500) });
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 10_000) });
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 11_000) });

    // One shared `now` for every row of this round — this is what makes the
    // two players' rows tie on `finishedAt` exactly, the scenario this test
    // exists to cover.
    const finishedAt = new Date(start.getTime() + 12_000);
    await recordLiveQuizRoundInsights({ liveSessionPort: port, insightsRepo }, created.code, finishedAt);

    const first = await getSetInsights({ setRepo, cardRepo, insightsRepo }, set.id, owner.id);
    const second = await getSetInsights({ setRepo, cardRepo, insightsRepo }, set.id, owner.id);

    expect(first.studentStats).toHaveLength(2);
    const firstOrder = first.studentStats.map((s) => [s.userId, s.anonymizedIndex]);
    const secondOrder = second.studentStats.map((s) => [s.userId, s.anonymizedIndex]);
    expect(firstOrder).toEqual(secondOrder); // deterministic across repeated calls despite the tie
    expect(new Set(first.studentStats.map((s) => s.anonymizedIndex))).toEqual(new Set([1, 2])); // exactly one Student 1, one Student 2
  });
});
