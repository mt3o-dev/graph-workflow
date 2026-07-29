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
import { startReviewSession, submitReview, type Schedulers } from "../src/core/usecases/reviewUsecases";
import { changeSchedulerPreference } from "../src/core/usecases/authUsecases";
import type { ReviewState, FsrsReviewState } from "../src/core/domain/types";

const dbPath = `./data/test-review-${crypto.randomUUID()}.db`;
const sqlite = new Database(dbPath, { create: true });
const db = drizzle(sqlite, { schema });

afterAll(() => {
  sqlite.close();
  try {
    unlinkSync(dbPath);
    unlinkSync(`${dbPath}-shm`);
    unlinkSync(`${dbPath}-wal`);
  } catch {
    // best-effort cleanup, fine if wal/shm files don't exist
  }
});

const setRepo = createSetRepoSqlite(db as never);
const cardRepo = createCardRepoSqlite(db as never);
const userRepo = createUserRepoSqlite(db as never);
const sm2Scheduler = createSchedulerRepoSqlite(db as never);
const fsrsScheduler = createFsrsSchedulerRepoSqlite(db as never);
const schedulers: Schedulers = { sm2: sm2Scheduler, fsrs: fsrsScheduler };

describe("reviewUsecases: submitReview dispatches to the correct scheduler (sqlite driver, temp db)", () => {
  test("a user with schedulerPreference='sm2' (the default) writes to review_states only", async () => {
    await migrateSqlite(db as never);

    const user = await userRepo.create({ email: "sm2-user@example.com", passwordHash: "h", displayName: "SM2 User" });
    expect(user.schedulerPreference).toBe("sm2"); // default preserved for existing/new users

    const set = await createSet(setRepo, { ownerId: user.id, title: "SM2 set" });
    const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: user.id, type: "basic", payload: { front: "f", back: "b" } });

    const result = await submitReview(schedulers, {
      cardId: card.id,
      userId: user.id,
      quality: 4,
      schedulerPreference: user.schedulerPreference,
      now: new Date("2026-02-01T00:00:00Z"),
    });

    expect((result as ReviewState).easiness).toBeDefined();
    expect(await sm2Scheduler.get(card.id, user.id)).not.toBeNull();
    expect(await fsrsScheduler.get(card.id, user.id)).toBeNull();
  });

  test("a user with schedulerPreference='fsrs' writes to fsrs_review_states only", async () => {
    const user = await userRepo.create({ email: "fsrs-user@example.com", passwordHash: "h", displayName: "FSRS User" });
    await changeSchedulerPreference(userRepo, user.id, "fsrs");
    const updated = await userRepo.findById(user.id);
    expect(updated!.schedulerPreference).toBe("fsrs");

    const set = await createSet(setRepo, { ownerId: user.id, title: "FSRS set" });
    const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: user.id, type: "basic", payload: { front: "f", back: "b" } });

    const result = await submitReview(schedulers, {
      cardId: card.id,
      userId: user.id,
      quality: 4,
      schedulerPreference: "fsrs",
      now: new Date("2026-02-01T00:00:00Z"),
    });

    expect((result as FsrsReviewState).difficulty).toBeDefined();
    expect((result as FsrsReviewState).stability).toBeDefined();
    expect(await fsrsScheduler.get(card.id, user.id)).not.toBeNull();
    expect(await sm2Scheduler.get(card.id, user.id)).toBeNull();
  });

  test("startReviewSession picks the due-list from the scheduler matching the user's preference", async () => {
    const sm2User = await userRepo.create({ email: "session-sm2@example.com", passwordHash: "h", displayName: "SM2 Session" });
    const fsrsUser = await userRepo.create({ email: "session-fsrs@example.com", passwordHash: "h", displayName: "FSRS Session" });
    await changeSchedulerPreference(userRepo, fsrsUser.id, "fsrs");

    const sm2Set = await createSet(setRepo, { ownerId: sm2User.id, title: "SM2 due set" });
    await addCard(cardRepo, setRepo, { setId: sm2Set.id, ownerId: sm2User.id, type: "basic", payload: { front: "f", back: "b" } });

    const fsrsSet = await createSet(setRepo, { ownerId: fsrsUser.id, title: "FSRS due set" });
    await addCard(cardRepo, setRepo, { setId: fsrsSet.id, ownerId: fsrsUser.id, type: "basic", payload: { front: "f", back: "b" } });

    const sm2Due = await startReviewSession(cardRepo, schedulers, sm2User.id, "sm2");
    expect(sm2Due).toHaveLength(1); // never-reviewed card is always due

    const fsrsDue = await startReviewSession(cardRepo, schedulers, fsrsUser.id, "fsrs");
    expect(fsrsDue).toHaveLength(1);
  });

  describe("sm2 -> fsrs bootstrap: switching preference mid-use preserves an existing card's progress", () => {
    test("a card reviewed several times under sm2, then switched to fsrs, bootstraps instead of resetting", async () => {
      const user = await userRepo.create({ email: "switcher@example.com", passwordHash: "h", displayName: "Switcher" });
      const set = await createSet(setRepo, { ownerId: user.id, title: "Switch set" });
      const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: user.id, type: "basic", payload: { front: "f", back: "b" } });

      // Three good SM-2 reviews, a week apart, building up interval/easiness.
      let now = new Date("2026-01-01T00:00:00Z");
      await submitReview(schedulers, { cardId: card.id, userId: user.id, quality: 4, schedulerPreference: "sm2", now });
      now = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await submitReview(schedulers, { cardId: card.id, userId: user.id, quality: 4, schedulerPreference: "sm2", now });
      now = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await submitReview(schedulers, { cardId: card.id, userId: user.id, quality: 4, schedulerPreference: "sm2", now });

      const sm2StateBeforeSwitch = await sm2Scheduler.get(card.id, user.id);
      expect(sm2StateBeforeSwitch).not.toBeNull();
      expect(sm2StateBeforeSwitch!.interval).toBeGreaterThan(0);
      expect(sm2StateBeforeSwitch!.repetitions).toBe(3);

      // Switch preference — no fsrs row exists yet.
      await changeSchedulerPreference(userRepo, user.id, "fsrs");
      expect(await fsrsScheduler.get(card.id, user.id)).toBeNull();

      // Next review under fsrs bootstraps from the sm2 state rather than starting fresh.
      now = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const bootstrapped = (await submitReview(schedulers, {
        cardId: card.id,
        userId: user.id,
        quality: 4,
        schedulerPreference: "fsrs",
        now,
      })) as FsrsReviewState;

      // reps > 1 proves the "existing card" update path ran (fsrs() bumps
      // reps by 1 from the bootstrapped base), not the fresh-card S0/D0 path
      // (which would have produced reps === 1).
      expect(bootstrapped.reps).toBeGreaterThan(1);
      expect(bootstrapped.stability).toBeGreaterThan(0);

      // The original sm2 row is untouched — bootstrap reads it, never mutates it.
      const sm2StateAfterSwitch = await sm2Scheduler.get(card.id, user.id);
      expect(sm2StateAfterSwitch).toEqual(sm2StateBeforeSwitch);
    });

    test("a genuinely new card (no sm2 history) gets fsrs's normal fresh-card path when reviewed under fsrs", async () => {
      const user = await userRepo.create({ email: "fresh-fsrs@example.com", passwordHash: "h", displayName: "Fresh FSRS" });
      await changeSchedulerPreference(userRepo, user.id, "fsrs");
      const set = await createSet(setRepo, { ownerId: user.id, title: "Fresh set" });
      const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: user.id, type: "basic", payload: { front: "f", back: "b" } });

      expect(await sm2Scheduler.get(card.id, user.id)).toBeNull();

      const result = (await submitReview(schedulers, {
        cardId: card.id,
        userId: user.id,
        quality: 4,
        schedulerPreference: "fsrs",
        now: new Date("2026-03-01T00:00:00Z"),
      })) as FsrsReviewState;

      expect(result.reps).toBe(1); // fresh-card path: this was its very first review under either scheduler
    });
  });
});
