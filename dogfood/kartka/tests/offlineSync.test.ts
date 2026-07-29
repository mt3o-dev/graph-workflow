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
import { getOfflineBundle, syncOfflineReviews, type Schedulers } from "../src/core/usecases/reviewUsecases";

const dbPath = `./data/test-offline-sync-${crypto.randomUUID()}.db`;
const sqlite = new Database(dbPath, { create: true });
const db = drizzle(sqlite, { schema });

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

const setRepo = createSetRepoSqlite(db as never);
const cardRepo = createCardRepoSqlite(db as never);
const userRepo = createUserRepoSqlite(db as never);
const sm2Scheduler = createSchedulerRepoSqlite(db as never);
const fsrsScheduler = createFsrsSchedulerRepoSqlite(db as never);
const schedulers: Schedulers = { sm2: sm2Scheduler, fsrs: fsrsScheduler };

await migrateSqlite(db as never);

describe("reviewUsecases.syncOfflineReviews — ownership", () => {
  test("skips a card the requesting user does not own, instead of applying or throwing", async () => {
    const owner = await userRepo.create({ email: "owner-sync@example.com", passwordHash: "h", displayName: "Owner" });
    const intruder = await userRepo.create({ email: "intruder-sync@example.com", passwordHash: "h", displayName: "Intruder" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Owner set" });
    const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f", back: "b" } });

    const result = await syncOfflineReviews(
      cardRepo,
      setRepo,
      schedulers,
      intruder.id,
      "sm2",
      [{ cardId: card.id, quality: 4, answeredAt: new Date("2026-01-01T00:00:00Z") }],
      new Date("2026-01-02T00:00:00Z"),
    );

    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toEqual([{ cardId: card.id, reason: "not_owned" }]);
    expect(await sm2Scheduler.get(card.id, intruder.id)).toBeNull();
  });

  test("skips an unknown cardId cleanly", async () => {
    const user = await userRepo.create({ email: "unknown-card-sync@example.com", passwordHash: "h", displayName: "U" });
    const result = await syncOfflineReviews(
      cardRepo,
      setRepo,
      schedulers,
      user.id,
      "sm2",
      [{ cardId: "does-not-exist", quality: 4, answeredAt: new Date("2026-01-01T00:00:00Z") }],
      new Date("2026-01-02T00:00:00Z"),
    );
    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toEqual([{ cardId: "does-not-exist", reason: "not_owned" }]);
  });
});

describe("reviewUsecases.syncOfflineReviews — chronological replay per card", () => {
  test("two offline reviews of the same card in one batch, submitted out of order, replay oldest-first", async () => {
    const user = await userRepo.create({ email: "chrono@example.com", passwordHash: "h", displayName: "Chrono" });
    const set = await createSet(setRepo, { ownerId: user.id, title: "Chrono set" });
    const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: user.id, type: "basic", payload: { front: "f", back: "b" } });

    const earlier = new Date("2026-01-05T09:00:00Z");
    const later = new Date("2026-01-06T09:00:00Z");

    // Batch arrives with the LATER review listed first — the function must
    // still apply `earlier` before `later`.
    const result = await syncOfflineReviews(
      cardRepo,
      setRepo,
      schedulers,
      user.id,
      "sm2",
      [
        { cardId: card.id, quality: 4, answeredAt: later },
        { cardId: card.id, quality: 1, answeredAt: earlier }, // a fail, first chronologically
      ],
      new Date("2026-01-07T00:00:00Z"),
    );

    expect(result.skipped).toHaveLength(0);
    expect(result.applied).toHaveLength(2);
    // Applied order in the returned array reflects replay order (chronological).
    expect(result.applied[0]!.answeredAt.getTime()).toBe(earlier.getTime());
    expect(result.applied[1]!.answeredAt.getTime()).toBe(later.getTime());

    const finalState = await sm2Scheduler.get(card.id, user.id);
    expect(finalState).not.toBeNull();
    // If replay had gone last-write-wins (later applied first, then earlier
    // undoing it), repetitions would end at 0 (the quality=1 "fail" reset
    // would be the LAST thing applied). Correct chronological replay applies
    // the fail first (repetitions -> 0) then the quality=4 pass on top
    // (repetitions -> 1).
    expect(finalState!.repetitions).toBe(1);
    expect(finalState!.lastReviewedAt!.getTime()).toBe(later.getTime());
  });

  test("3 reviews of one card, scrambled arrival order, one future-dated, still replay chronologically with a monotonic clamped sequence", async () => {
    const user = await userRepo.create({ email: "adversarial-chrono@example.com", passwordHash: "h", displayName: "Adv" });
    const set = await createSet(setRepo, { ownerId: user.id, title: "Adv set" });
    const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: user.id, type: "basic", payload: { front: "f", back: "b" } });

    const serverNow = new Date("2026-01-10T00:00:00Z");
    const oldest = new Date("2026-01-01T00:00:00Z"); // quality 1 (fail)
    const middle = new Date("2026-01-05T00:00:00Z"); // quality 4 (pass)
    const future = new Date("2099-01-01T00:00:00Z"); // quality 5, must clamp to serverNow

    // Arrival order is deliberately scrambled: middle, future, oldest.
    const result = await syncOfflineReviews(
      cardRepo,
      setRepo,
      schedulers,
      user.id,
      "sm2",
      [
        { cardId: card.id, quality: 4, answeredAt: middle },
        { cardId: card.id, quality: 5, answeredAt: future },
        { cardId: card.id, quality: 1, answeredAt: oldest },
      ],
      serverNow,
    );

    expect(result.skipped).toHaveLength(0);
    expect(result.applied.map((a) => a.answeredAt.getTime())).toEqual([oldest.getTime(), middle.getTime(), serverNow.getTime()]);

    const times = result.applied.map((a) => a.answeredAt.getTime());
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]!);

    // fail (reps->0) then pass (reps->1) then pass (reps->2): proves replay
    // order is chronological, not arrival order (which would end at reps=0,
    // since arrival order applies the fail last).
    const finalState = await sm2Scheduler.get(card.id, user.id);
    expect(finalState!.repetitions).toBe(2);
    expect(finalState!.lastReviewedAt!.getTime()).toBe(serverNow.getTime());
  });
});

describe("reviewUsecases.syncOfflineReviews — timestamp clamping", () => {
  test("a client answeredAt in the future is clamped down to serverNow", async () => {
    const user = await userRepo.create({ email: "future-clamp@example.com", passwordHash: "h", displayName: "Future" });
    const set = await createSet(setRepo, { ownerId: user.id, title: "Future set" });
    const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: user.id, type: "basic", payload: { front: "f", back: "b" } });

    const serverNow = new Date("2026-01-10T00:00:00Z");
    const skewedFuture = new Date("2099-01-01T00:00:00Z");

    const result = await syncOfflineReviews(
      cardRepo,
      setRepo,
      schedulers,
      user.id,
      "sm2",
      [{ cardId: card.id, quality: 4, answeredAt: skewedFuture }],
      serverNow,
    );

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]!.answeredAt.getTime()).toBe(serverNow.getTime());
    const state = await sm2Scheduler.get(card.id, user.id);
    expect(state!.lastReviewedAt!.getTime()).toBe(serverNow.getTime());
  });

  test("a client answeredAt earlier than the card's last known lastReviewedAt is clamped up to that floor, not rejected", async () => {
    const user = await userRepo.create({ email: "rewind-clamp@example.com", passwordHash: "h", displayName: "Rewind" });
    const set = await createSet(setRepo, { ownerId: user.id, title: "Rewind set" });
    const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: user.id, type: "basic", payload: { front: "f", back: "b" } });

    const firstReviewAt = new Date("2026-02-01T00:00:00Z");
    await syncOfflineReviews(cardRepo, setRepo, schedulers, user.id, "sm2", [{ cardId: card.id, quality: 4, answeredAt: firstReviewAt }], new Date(
      "2026-02-02T00:00:00Z",
    ));
    const stateAfterFirst = await sm2Scheduler.get(card.id, user.id);
    expect(stateAfterFirst!.lastReviewedAt!.getTime()).toBe(firstReviewAt.getTime());

    // A second, separate sync batch claims a review that "happened" before
    // the first one ever did — a rewound/skewed client clock. The scheduler
    // can't sensibly rewind, so this is clamped up to firstReviewAt, not
    // rejected outright (the review still gets applied — see docstring).
    const rewound = new Date("2026-01-15T00:00:00Z");
    const serverNow = new Date("2026-02-03T00:00:00Z");
    const result = await syncOfflineReviews(cardRepo, setRepo, schedulers, user.id, "sm2", [{ cardId: card.id, quality: 5, answeredAt: rewound }], serverNow);

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]!.answeredAt.getTime()).toBe(firstReviewAt.getTime()); // clamped up to the floor, not `rewound`
    const stateAfterRewind = await sm2Scheduler.get(card.id, user.id);
    expect(stateAfterRewind!.lastReviewedAt!.getTime()).toBe(firstReviewAt.getTime());
  });

  test("invalid quality and invalid timestamp are skipped, not clamped/coerced", async () => {
    const user = await userRepo.create({ email: "invalid-input@example.com", passwordHash: "h", displayName: "Invalid" });
    const set = await createSet(setRepo, { ownerId: user.id, title: "Invalid set" });
    const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: user.id, type: "basic", payload: { front: "f", back: "b" } });

    const result = await syncOfflineReviews(
      cardRepo,
      setRepo,
      schedulers,
      user.id,
      "sm2",
      [
        { cardId: card.id, quality: 9 as never, answeredAt: new Date("2026-03-01T00:00:00Z") },
        { cardId: card.id, quality: 3, answeredAt: new Date("not-a-date") },
      ],
      new Date("2026-03-02T00:00:00Z"),
    );

    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        { cardId: card.id, reason: "invalid_quality" },
        { cardId: card.id, reason: "invalid_timestamp" },
      ]),
    );
    expect(await sm2Scheduler.get(card.id, user.id)).toBeNull();
  });
});

describe("reviewUsecases.getOfflineBundle — ownership + cap", () => {
  test("only returns due cards owned by the requesting user, capped at `limit`", async () => {
    const owner = await userRepo.create({ email: "bundle-owner@example.com", passwordHash: "h", displayName: "Bundle Owner" });
    const other = await userRepo.create({ email: "bundle-other@example.com", passwordHash: "h", displayName: "Bundle Other" });

    const ownerSet = await createSet(setRepo, { ownerId: owner.id, title: "Owner bundle set" });
    for (let i = 0; i < 3; i++) {
      await addCard(cardRepo, setRepo, { setId: ownerSet.id, ownerId: owner.id, type: "basic", payload: { front: `f${i}`, back: `b${i}` } });
    }
    const otherSet = await createSet(setRepo, { ownerId: other.id, title: "Other bundle set" });
    await addCard(cardRepo, setRepo, { setId: otherSet.id, ownerId: other.id, type: "basic", payload: { front: "of", back: "ob" } });

    const bundle = await getOfflineBundle(cardRepo, schedulers, owner.id, "sm2", 2);
    expect(bundle.length).toBeLessThanOrEqual(2); // cap respected
    expect(bundle.every((c) => c.setId === ownerSet.id)).toBe(true); // never another user's cards
  });
});
