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
import { createSet } from "../src/core/usecases/setUsecases";
import { addCard } from "../src/core/usecases/cardUsecases";
import { createInMemoryLiveSessionPort } from "../src/adapters/liveQuiz/inMemoryLiveSessionPort";
import { createLiveSession, joinLiveSession, advanceLiveQuestion, submitLiveAnswer } from "../src/core/usecases/liveQuizUsecases";
import { submitReview } from "../src/core/usecases/reviewUsecases";
import {
  importPostGameReviewForRoom,
  seedReviewStateForImportedCard,
  PRACTICE_SET_MARKER,
  IMPORTED_CARD_DUE_HOURS,
  type Schedulers,
} from "../src/core/usecases/liveQuizPostGameUsecases";
import { sm2InitialState, sm2, addDays } from "../src/core/domain/sm2";
import { fsrsInitialState } from "../src/core/domain/fsrs";
import { ValidationError, NotFoundError } from "../src/core/domain/errors";

// This suite covers slice 15 end to end: the clone+seed post-game review
// import, its practice-set find-or-create/dedupe mechanics, the seeded
// review state's shortened due date, and the regression-adjacent proof that
// a seeded card behaves completely normally through the REAL submitReview
// path afterward. tests/liveQuiz.test.ts covers the pure
// computeMissedQuestionsForPlayer detection with zero DB/usecase involvement.

const dbPath = `./data/test-postgame-review-${crypto.randomUUID()}.db`;
const sqlite = new Database(dbPath, { create: true });
const db = drizzle(sqlite, { schema });
await migrateSqlite(db as never);

const setRepo = createSetRepoSqlite(db as never);
const cardRepo = createCardRepoSqlite(db as never);
const userRepo = createUserRepoSqlite(db as never);
const sm2Scheduler = createSchedulerRepoSqlite(db as never);
const fsrsScheduler = createFsrsSchedulerRepoSqlite(db as never);
const schedulers: Schedulers = { sm2: sm2Scheduler, fsrs: fsrsScheduler };

const TITLES = { pl: "Powtórka z quizu na żywo", en: "Live quiz review" };

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

/** Two multiple_choice cards, correct option always at index 1. */
async function makeTwoMcCardSet(ownerId: string) {
  const set = await createSet(setRepo, { ownerId, title: "Post-game source set" });
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

/**
 * Plays a full round of `set`'s 2 cards for one player: cardA answered
 * WRONG, cardB answered CORRECT but SLOW (15s of the 20s/14s-cutoff budget)
 * — both count as "missed" per computeMissedQuestionsForPlayer, giving the
 * import something real to do. Advances the room all the way to "finished".
 * Returns the room code.
 */
async function playRoundWithTwoMisses(
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
  await submitLiveAnswer(port, { code: created.code, userId: playerId, cardId: cardAId, rawAnswer: "0", now: new Date(start.getTime() + 1000) }); // wrong
  await advanceLiveQuestion(port, { code: created.code, hostId, now: new Date(start.getTime() + 5000) }); // reveal
  await advanceLiveQuestion(port, { code: created.code, hostId, now: new Date(start.getTime() + 60_000) }); // q1 live
  await submitLiveAnswer(port, {
    code: created.code,
    userId: playerId,
    cardId: cardBId,
    rawAnswer: "1",
    now: new Date(start.getTime() + 60_000 + 15_000), // 15s in — past the 14s (70%) slow cutoff
  });
  await advanceLiveQuestion(port, { code: created.code, hostId, now: new Date(start.getTime() + 80_000) }); // reveal
  await advanceLiveQuestion(port, { code: created.code, hostId, now: new Date(start.getTime() + 81_000) }); // -> finished

  return created.code;
}

describe("importPostGameReviewForRoom", () => {
  test("only runs on a finished room — throws ValidationError otherwise", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`notfinished-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`notfinished-player-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);
    const room = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    await joinLiveSession(port, { code: room.code, userId: player.id, displayName: "Player" });

    await expect(
      importPostGameReviewForRoom({ liveSessionPort: port, setRepo, cardRepo, userRepo, schedulers }, room.code, TITLES),
    ).rejects.toThrow(ValidationError);
    void cardA;
    void cardB;
  });

  test("an unknown room code 404s", async () => {
    const port = createInMemoryLiveSessionPort();
    await expect(
      importPostGameReviewForRoom({ liveSessionPort: port, setRepo, cardRepo, userRepo, schedulers }, "ZZZZZ", TITLES),
    ).rejects.toThrow(NotFoundError);
  });

  test("clones+seeds every missed/slow question into a NEW personal practice set, owned by the player — never the host", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`import-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`import-player-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);
    const start = new Date("2026-04-01T00:00:00.000Z");
    const code = await playRoundWithTwoMisses(port, set.id, owner.id, player.id, cardA.id, cardB.id, start);

    const results = await importPostGameReviewForRoom(
      { liveSessionPort: port, setRepo, cardRepo, userRepo, schedulers },
      code,
      TITLES,
      new Date("2026-04-01T00:02:00.000Z"),
    );

    const mine = results.find((r) => r.userId === player.id);
    expect(mine?.importedCount).toBe(2); // both cardA (wrong) and cardB (slow) were missed

    // Ownership (roadmap point 7): the practice set + both clones belong to
    // the PLAYER, never the host — the source set stays completely untouched.
    const practiceSet = await setRepo.findByOwnerAndDescription(player.id, PRACTICE_SET_MARKER);
    expect(practiceSet).not.toBeNull();
    expect(practiceSet!.ownerId).toBe(player.id);
    expect(practiceSet!.ownerId).not.toBe(owner.id);

    const clonedCards = await cardRepo.listAllBySet(practiceSet!.id);
    expect(clonedCards).toHaveLength(2);
    expect(clonedCards.map((c) => c.sourceCardId).sort()).toEqual([cardA.id, cardB.id].sort());

    // The source set/cards are never mutated — same non-mutation guarantee as slice 3's clone.
    const sourceCardsAfter = await cardRepo.listAllBySet(set.id);
    expect(sourceCardsAfter).toHaveLength(2);
    expect(await setRepo.findByOwnerAndDescription(owner.id, PRACTICE_SET_MARKER)).toBeNull(); // host never gets one (didn't play)
  });

  test("a player who got everything right and fast gets importedCount 0 and no practice set is created for them", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`perfect-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`perfect-player-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);

    const created = await createLiveSession(port, setRepo, cardRepo, { setId: set.id, hostId: owner.id });
    await joinLiveSession(port, { code: created.code, userId: player.id, displayName: "Player" });
    const start = new Date("2026-04-02T00:00:00.000Z");
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: start });
    await submitLiveAnswer(port, { code: created.code, userId: player.id, cardId: cardA.id, rawAnswer: "1", now: new Date(start.getTime() + 500) });
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 5000) });
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 6000) });
    await submitLiveAnswer(port, { code: created.code, userId: player.id, cardId: cardB.id, rawAnswer: "1", now: new Date(start.getTime() + 6500) });
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 10_000) });
    await advanceLiveQuestion(port, { code: created.code, hostId: owner.id, now: new Date(start.getTime() + 11_000) }); // finished

    const results = await importPostGameReviewForRoom({ liveSessionPort: port, setRepo, cardRepo, userRepo, schedulers }, created.code, TITLES);
    expect(results.find((r) => r.userId === player.id)?.importedCount).toBe(0);
    expect(await setRepo.findByOwnerAndDescription(player.id, PRACTICE_SET_MARKER)).toBeNull();
  });

  test("the personal practice set is created once and REUSED across a second round (not duplicated)", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`reuse-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`reuse-player-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);

    const code1 = await playRoundWithTwoMisses(port, set.id, owner.id, player.id, cardA.id, cardB.id, new Date("2026-05-01T00:00:00.000Z"));
    await importPostGameReviewForRoom({ liveSessionPort: port, setRepo, cardRepo, userRepo, schedulers }, code1, TITLES);

    // A second, independent round of the SAME set.
    const code2 = await playRoundWithTwoMisses(port, set.id, owner.id, player.id, cardA.id, cardB.id, new Date("2026-05-02T00:00:00.000Z"));
    await importPostGameReviewForRoom({ liveSessionPort: port, setRepo, cardRepo, userRepo, schedulers }, code2, TITLES);

    // Only ONE practice set exists for this player, ever.
    const all = await setRepo.listByOwner(player.id, { page: 1, pageSize: 100, sortBy: "createdAt", sortDir: "asc" });
    const practiceSets = all.items.filter((s) => s.description === PRACTICE_SET_MARKER);
    expect(practiceSets).toHaveLength(1);
  });

  test("dedupe: the SAME source card seen across two different rounds is only cloned+seeded once", async () => {
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`dedupe-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`dedupe-player-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);

    const code1 = await playRoundWithTwoMisses(port, set.id, owner.id, player.id, cardA.id, cardB.id, new Date("2026-06-01T00:00:00.000Z"));
    const first = await importPostGameReviewForRoom({ liveSessionPort: port, setRepo, cardRepo, userRepo, schedulers }, code1, TITLES);
    expect(first.find((r) => r.userId === player.id)?.importedCount).toBe(2);

    // Same set, same two cards missed again in an independent second round.
    const code2 = await playRoundWithTwoMisses(port, set.id, owner.id, player.id, cardA.id, cardB.id, new Date("2026-06-02T00:00:00.000Z"));
    const second = await importPostGameReviewForRoom({ liveSessionPort: port, setRepo, cardRepo, userRepo, schedulers }, code2, TITLES);
    expect(second.find((r) => r.userId === player.id)?.importedCount).toBe(0); // both already imported — nothing new

    const practiceSet = await setRepo.findByOwnerAndDescription(player.id, PRACTICE_SET_MARKER);
    const clonedCards = await cardRepo.listAllBySet(practiceSet!.id);
    expect(clonedCards).toHaveLength(2); // still exactly 2, not 4

    // Calling the import a THIRD time for the very same (already-processed)
    // round is also a no-op — the "multiple clients polling finished" case.
    const third = await importPostGameReviewForRoom({ liveSessionPort: port, setRepo, cardRepo, userRepo, schedulers }, code1, TITLES);
    expect(third.find((r) => r.userId === player.id)?.importedCount).toBe(0);
    expect(await cardRepo.listAllBySet(practiceSet!.id)).toHaveLength(2);
  });

  test("concurrent import calls for the same finished room never produce duplicate clone cards (review-found race, now DB-constrained)", async () => {
    // Regression test for a real race the review caught: two concurrent
    // finished-room renders (e.g. a broadcast in flight plus a reconnecting
    // socket) can both read "not yet imported" for the same (set,
    // sourceCardId) pair before either writes. A DB-level partial unique
    // index (migrateSqlite.ts/migratePg.ts) now closes this properly, and
    // the usecase treats the resulting constraint violation as "someone
    // else already imported it" rather than crashing. Firing several
    // genuinely-concurrent import calls (not sequential awaits) is the only
    // way to actually exercise the interleaving this bug required.
    const port = createInMemoryLiveSessionPort();
    const owner = await makeUser(`race-owner-${crypto.randomUUID()}@example.com`);
    const player = await makeUser(`race-player-${crypto.randomUUID()}@example.com`);
    const { set, cardA, cardB } = await makeTwoMcCardSet(owner.id);
    const code = await playRoundWithTwoMisses(port, set.id, owner.id, player.id, cardA.id, cardB.id, new Date("2026-07-01T00:00:00.000Z"));

    const deps = { liveSessionPort: port, setRepo, cardRepo, userRepo, schedulers };
    const results = await Promise.all([
      importPostGameReviewForRoom(deps, code, TITLES),
      importPostGameReviewForRoom(deps, code, TITLES),
      importPostGameReviewForRoom(deps, code, TITLES),
      importPostGameReviewForRoom(deps, code, TITLES),
      importPostGameReviewForRoom(deps, code, TITLES),
    ]);

    // None of the 5 concurrent calls should throw (already asserted by
    // Promise.all not rejecting above) and the total imported across all of
    // them, for this player, must never exceed 2 — however the race
    // interleaves, at most one call actually creates each clone.
    const totalImported = results.reduce((sum, r) => sum + (r.find((x) => x.userId === player.id)?.importedCount ?? 0), 0);
    expect(totalImported).toBeLessThanOrEqual(2);

    const practiceSet = await setRepo.findByOwnerAndDescription(player.id, PRACTICE_SET_MARKER);
    const clonedCards = await cardRepo.listAllBySet(practiceSet!.id);
    expect(clonedCards).toHaveLength(2); // exactly 2, never a duplicate from the race
    const sourceIds = new Set(clonedCards.map((c) => c.sourceCardId));
    expect(sourceIds.size).toBe(2); // both are distinct source cards, no dupes
  });
});

describe("seedReviewStateForImportedCard", () => {
  test("SM-2: seeded dueAt is genuinely SHORTER than the shortest interval submitReview's own SM-2 formula ever produces on a first review", async () => {
    const owner = await makeUser(`seed-sm2-owner-${crypto.randomUUID()}@example.com`);
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Seed target set" });
    const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f", back: "b" } });
    const user = await makeUser(`seed-sm2-user-${crypto.randomUUID()}@example.com`);

    const now = new Date("2026-07-01T00:00:00.000Z");
    const seeded = await seedReviewStateForImportedCard(schedulers, card.id, user.id, "sm2", now);

    // The real SM-2 formula's OWN first-touch interval (any quality) is 1 day.
    const firstTouch = sm2({ ...sm2InitialState(), quality: 4 });
    expect(firstTouch.interval).toBe(1);
    const normalFirstDueAt = addDays(now, firstTouch.interval);

    expect((seeded as { dueAt: Date }).dueAt.getTime()).toBeGreaterThan(now.getTime());
    expect((seeded as { dueAt: Date }).dueAt.getTime()).toBeLessThan(normalFirstDueAt.getTime());
    expect((seeded as { dueAt: Date }).dueAt.getTime()).toBe(addDays(now, IMPORTED_CARD_DUE_HOURS / 24).getTime());

    // Defaults otherwise match a genuinely never-reviewed card's own baseline.
    const base = sm2InitialState();
    const s = seeded as { easiness: number; interval: number; repetitions: number; lastReviewedAt: Date | null };
    expect(s.easiness).toBe(base.easiness);
    expect(s.interval).toBe(base.interval);
    expect(s.repetitions).toBe(base.repetitions);
    expect(s.lastReviewedAt).toBeNull();
  });

  test("FSRS: seeded dueAt is also shortened, using fsrsInitialState()'s own defaults", async () => {
    const owner = await makeUser(`seed-fsrs-owner-${crypto.randomUUID()}@example.com`);
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Seed target set (fsrs)" });
    const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f", back: "b" } });
    const user = await makeUser(`seed-fsrs-user-${crypto.randomUUID()}@example.com`);

    const now = new Date("2026-07-02T00:00:00.000Z");
    const seeded = await seedReviewStateForImportedCard(schedulers, card.id, user.id, "fsrs", now);
    const base = fsrsInitialState();
    const s = seeded as { difficulty: number; stability: number; reps: number; dueAt: Date; lastReviewedAt: Date | null };

    expect(s.difficulty).toBe(base.difficulty);
    expect(s.stability).toBe(base.stability);
    expect(s.reps).toBe(base.reps);
    expect(s.lastReviewedAt).toBeNull();
    expect(s.dueAt.getTime()).toBe(addDays(now, IMPORTED_CARD_DUE_HOURS / 24).getTime());
    expect(s.dueAt.getTime()).toBeGreaterThan(now.getTime());
  });

  test("after seeding, a REAL submitReview call against the imported card works exactly like any normal card (regression-adjacent proof)", async () => {
    const owner = await makeUser(`postseed-owner-${crypto.randomUUID()}@example.com`);
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Post-seed set" });
    const seededCard = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f", back: "b" } });
    const freshCard = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f2", back: "b2" } });
    const user = await makeUser(`postseed-user-${crypto.randomUUID()}@example.com`);

    const seedNow = new Date("2026-08-01T00:00:00.000Z");
    await seedReviewStateForImportedCard(schedulers, seededCard.id, user.id, "sm2", seedNow);

    // A LATER real review, quality 4 ("Good"), of both the seeded card and an
    // ordinary never-touched card — the SM-2 result must be byte-for-byte
    // identical, because seedReviewStateForImportedCard used the exact same
    // sm2InitialState() baseline a genuinely fresh card starts from.
    const reviewNow = new Date("2026-08-05T00:00:00.000Z");
    const seededResult = await submitReview(schedulers, {
      cardId: seededCard.id,
      userId: user.id,
      quality: 4,
      schedulerPreference: "sm2",
      now: reviewNow,
    });
    const freshResult = await submitReview(schedulers, {
      cardId: freshCard.id,
      userId: user.id,
      quality: 4,
      schedulerPreference: "sm2",
      now: reviewNow,
    });

    const a = seededResult as { easiness: number; interval: number; repetitions: number; dueAt: Date };
    const b = freshResult as { easiness: number; interval: number; repetitions: number; dueAt: Date };
    expect(a.easiness).toBe(b.easiness);
    expect(a.interval).toBe(b.interval);
    expect(a.repetitions).toBe(b.repetitions);
    expect(a.dueAt.getTime()).toBe(b.dueAt.getTime());

    // And a SECOND real review afterward continues completely normally too.
    const secondReview = await submitReview(schedulers, {
      cardId: seededCard.id,
      userId: user.id,
      quality: 5,
      schedulerPreference: "sm2",
      now: new Date("2026-08-10T00:00:00.000Z"),
    });
    expect((secondReview as { repetitions: number }).repetitions).toBe(2);
  });
});
