import { describe, test, expect, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { unlinkSync } from "node:fs";
import * as schema from "../src/adapters/db/schema.sqlite";
import { migrateSqlite } from "../src/adapters/db/migrateSqlite";
import { createSetRepoSqlite } from "../src/adapters/db/setRepo.sqlite";
import { createCardRepoSqlite } from "../src/adapters/db/cardRepo.sqlite";
import { createUserRepoSqlite } from "../src/adapters/db/userRepo.sqlite";
import { createSchedulerRepoSqlite } from "../src/adapters/db/schedulerRepo.sqlite";
import { createFsrsSchedulerRepoSqlite } from "../src/adapters/db/fsrsSchedulerRepo.sqlite";
import { createLiveStreakBonusRepoSqlite } from "../src/adapters/db/liveStreakBonusRepo.sqlite";
import { createSet } from "../src/core/usecases/setUsecases";
import { addCard } from "../src/core/usecases/cardUsecases";
import { createInMemoryLiveSessionPort } from "../src/adapters/liveQuiz/inMemoryLiveSessionPort";
import {
  createLiveSession,
  joinLiveSession,
  advanceLiveQuestion,
  submitLiveAnswer,
} from "../src/core/usecases/liveQuizUsecases";
import { submitReview, type Schedulers } from "../src/core/usecases/reviewUsecases";
import type { RoomState } from "../src/core/domain/liveQuiz";

// This suite covers slice 14's durable pending-bonus mechanism end to end:
//   - liveQuizUsecases.submitLiveAnswer creating a 'pending' record on a real
//     streak-threshold crossing (through a real sqlite LiveStreakBonusRepo).
//   - the "skip if one is already unresolved for this (userId,cardId)" rule.
//   - reviewUsecases.submitReview resolving it (confirm/forfeit) on the
//     FIRST subsequent real review of the same card, and never again.
// tests/liveQuizStreakHint.test.ts covers the pure domain logic (streak
// detection, hint reveal) with zero DB/usecase involvement.

const dbPath = `./data/test-streak-bonus-${crypto.randomUUID()}.db`;
const sqlite = new Database(dbPath, { create: true });
const db = drizzle(sqlite, { schema });
await migrateSqlite(db as never);

const setRepo = createSetRepoSqlite(db as never);
const cardRepo = createCardRepoSqlite(db as never);
const userRepo = createUserRepoSqlite(db as never);
const sm2Scheduler = createSchedulerRepoSqlite(db as never);
const fsrsScheduler = createFsrsSchedulerRepoSqlite(db as never);
const bonusRepo = createLiveStreakBonusRepoSqlite(db as never);
const schedulers: Schedulers = { sm2: sm2Scheduler, fsrs: fsrsScheduler };

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

/** A set of exactly 3 multiple_choice cards, each with a correct option at index 1 (answer "1"). */
async function makeThreeMcCardSet(ownerId: string) {
  const set = await createSet(setRepo, { ownerId, title: "Streak set" });
  const cards = [];
  for (let i = 0; i < 3; i++) {
    const card = await addCard(cardRepo, setRepo, {
      setId: set.id,
      ownerId,
      type: "multiple_choice",
      payload: { question: `Q${i}`, options: ["wrong-a", "right", "wrong-b"], correctIndex: 1 },
    });
    cards.push(card);
  }
  return { set, cards };
}

/** Plays a full live round of `set`'s 3 cards, answering every question correctly, using the real usecases + bonusRepo. Returns the final (3rd) answer's result and its cardId. */
async function playPerfectRound(
  port: ReturnType<typeof createInMemoryLiveSessionPort>,
  setId: string,
  hostId: string,
  playerId: string,
) {
  const created = await createLiveSession(port, setRepo, cardRepo, { setId, hostId });
  await joinLiveSession(port, { code: created.code, userId: playerId, displayName: "Player" });

  let room: RoomState = await advanceLiveQuestion(port, { code: created.code, hostId }); // -> question 0 live
  let lastResult;
  let lastCardId = "";
  for (let i = 0; i < room.questions.length; i++) {
    const q = room.questions[room.currentQuestionIndex]!;
    const { result } = await submitLiveAnswer(port, { code: created.code, userId: playerId, cardId: q.cardId, rawAnswer: "1" }, bonusRepo);
    lastResult = result;
    lastCardId = q.cardId;
    if (i < room.questions.length - 1) {
      room = await advanceLiveQuestion(port, { code: created.code, hostId }); // -> reveal
      room = await advanceLiveQuestion(port, { code: created.code, hostId }); // -> next question live
    }
  }
  return { code: created.code, lastResult: lastResult!, lastCardId };
}

describe("submitLiveAnswer: durable pending-bonus creation", () => {
  test("a real streak-threshold crossing creates exactly one 'pending' record for (userId, cardId)", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`bonus-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`bonus-player-${crypto.randomUUID()}@example.com`);
    const { set } = await makeThreeMcCardSet(owner.id);

    const { lastResult, lastCardId } = await playPerfectRound(port, set.id, owner.id, player.id);
    expect(lastResult.streakBonusAwarded).toBe(true);

    const pending = await bonusRepo.findUnresolvedByUserAndCard(player.id, lastCardId);
    expect(pending).not.toBeNull();
    expect(pending!.status).toBe("pending");
    expect(pending!.points).toBe(lastResult.points);
  });

  test("does NOT create a second pending record for the same (userId, cardId) while one is unresolved (a second live round crossing again on the same card)", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`bonus-dup-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`bonus-dup-player-${crypto.randomUUID()}@example.com`);
    const { set } = await makeThreeMcCardSet(owner.id);

    const first = await playPerfectRound(port, set.id, owner.id, player.id);
    expect(first.lastResult.streakBonusAwarded).toBe(true);

    // Play a second, independent live round of the SAME set — the same 3rd
    // card completes the streak again (same cardId, since it's the same set).
    const second = await playPerfectRound(port, set.id, owner.id, player.id);
    expect(second.lastResult.streakBonusAwarded).toBe(true);
    expect(second.lastCardId).toBe(first.lastCardId);

    // Only ONE row (of any status) should exist for this (userId, cardId)
    // pair — count directly against the table rather than trusting
    // findUnresolvedByUserAndCard alone (it only ever returns a single row
    // even if more happened to exist).
    const all = await db.select().from(schema.liveStreakBonuses);
    const matching = all.filter((r) => r.userId === player.id && r.cardId === first.lastCardId);
    expect(matching).toHaveLength(1);
  });
});

describe("reviewUsecases.submitReview: resolving the pending streak bonus (the sacred path, extended)", () => {
  test("a pending bonus CONFIRMS on a subsequent correct real review, and its points show up in the lasting total", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`confirm-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`confirm-player-${crypto.randomUUID()}@example.com`);
    const { set } = await makeThreeMcCardSet(owner.id);

    const { lastResult, lastCardId } = await playPerfectRound(port, set.id, owner.id, player.id);
    expect(lastResult.streakBonusAwarded).toBe(true);

    const totalBefore = await bonusRepo.sumConfirmedPointsForUser(player.id);
    expect(totalBefore).toBe(0); // still pending, not yet confirmed

    // Quality 4 ("Good") is a passing real review — see quality.ts/sm2.ts's
    // own >=3 pass threshold, reused by resolvePendingStreakBonus.
    await submitReview(
      schedulers,
      { cardId: lastCardId, userId: player.id, quality: 4, schedulerPreference: "sm2", now: new Date("2026-02-01T00:00:00Z") },
      bonusRepo,
    );

    const resolved = await bonusRepo.findUnresolvedByUserAndCard(player.id, lastCardId);
    expect(resolved).toBeNull(); // no longer unresolved

    const totalAfter = await bonusRepo.sumConfirmedPointsForUser(player.id);
    expect(totalAfter).toBe(lastResult.points);
  });

  test("a pending bonus FORFEITS on a subsequent incorrect real review, and contributes nothing to the total", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`forfeit-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`forfeit-player-${crypto.randomUUID()}@example.com`);
    const { set } = await makeThreeMcCardSet(owner.id);

    const { lastResult, lastCardId } = await playPerfectRound(port, set.id, owner.id, player.id);
    expect(lastResult.streakBonusAwarded).toBe(true);

    // Quality 1 ("Again") is a failing real review.
    await submitReview(
      schedulers,
      { cardId: lastCardId, userId: player.id, quality: 1, schedulerPreference: "sm2", now: new Date("2026-02-01T00:00:00Z") },
      bonusRepo,
    );

    const resolved = await bonusRepo.findUnresolvedByUserAndCard(player.id, lastCardId);
    expect(resolved).toBeNull();

    const total = await bonusRepo.sumConfirmedPointsForUser(player.id);
    expect(total).toBe(0); // forfeited — never counted
  });

  test("only the FIRST subsequent review resolves it — a second review afterward doesn't re-resolve or double-count", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`once-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`once-player-${crypto.randomUUID()}@example.com`);
    const { set } = await makeThreeMcCardSet(owner.id);

    const { lastResult, lastCardId } = await playPerfectRound(port, set.id, owner.id, player.id);
    expect(lastResult.streakBonusAwarded).toBe(true);

    // First real review: passes, confirms the bonus.
    await submitReview(
      schedulers,
      { cardId: lastCardId, userId: player.id, quality: 4, schedulerPreference: "sm2", now: new Date("2026-02-01T00:00:00Z") },
      bonusRepo,
    );
    const totalAfterFirst = await bonusRepo.sumConfirmedPointsForUser(player.id);
    expect(totalAfterFirst).toBe(lastResult.points);

    // Second real review of the SAME card, later, this time failing quality
    // — must NOT flip the already-confirmed bonus to forfeited, and must
    // NOT change the lasting total.
    await submitReview(
      schedulers,
      { cardId: lastCardId, userId: player.id, quality: 1, schedulerPreference: "sm2", now: new Date("2026-02-05T00:00:00Z") },
      bonusRepo,
    );
    const totalAfterSecond = await bonusRepo.sumConfirmedPointsForUser(player.id);
    expect(totalAfterSecond).toBe(totalAfterFirst); // unchanged — no double-resolve
  });

  test("submitReview's SM-2 scheduling result is IDENTICAL whether or not bonusRepo is passed (pure side effect, zero influence on scheduling)", async () => {
    const owner = await makeUser(`identical-owner-${crypto.randomUUID()}@example.com`);
    const playerA = await makeUser(`identical-a-${crypto.randomUUID()}@example.com`);
    const playerB = await makeUser(`identical-b-${crypto.randomUUID()}@example.com`);
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Identical-scheduling set" });
    const cardA = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f", back: "b" } });
    const cardB = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f", back: "b" } });

    const now = new Date("2026-03-01T00:00:00Z");
    const withoutBonusRepo = await submitReview(schedulers, { cardId: cardA.id, userId: playerA.id, quality: 4, schedulerPreference: "sm2", now });
    const withBonusRepo = await submitReview(
      schedulers,
      { cardId: cardB.id, userId: playerB.id, quality: 4, schedulerPreference: "sm2", now },
      bonusRepo,
    );

    // Same input (quality/scheduler/now), different (fresh) cards/users —
    // the SM-2 result fields themselves must be identical either way.
    const a = withoutBonusRepo as { easiness: number; interval: number; repetitions: number };
    const b = withBonusRepo as { easiness: number; interval: number; repetitions: number };
    expect(b.easiness).toBe(a.easiness);
    expect(b.interval).toBe(a.interval);
    expect(b.repetitions).toBe(a.repetitions);
  });
});
