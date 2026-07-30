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
import { createSet, setExamDate } from "../src/core/usecases/setUsecases";
import { addCard } from "../src/core/usecases/cardUsecases";
import { previewCramSession, startCramSession } from "../src/core/usecases/cramUsecases";
import { submitReview, type Schedulers } from "../src/core/usecases/reviewUsecases";
import { ForbiddenError, NotFoundError, ValidationError } from "../src/core/domain/errors";
import type { ReviewState } from "../src/core/domain/types";

const dbPath = `./data/test-cram-${crypto.randomUUID()}.db`;
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

describe("cramUsecases (sqlite driver, temp db)", () => {
  test("setup: migrate", async () => {
    await migrateSqlite(db as never);
  });

  test("setExamDate: owner-only — a non-owner cannot set another user's exam date", async () => {
    const owner = await userRepo.create({ email: "cram-owner1@example.com", passwordHash: "h", displayName: "Owner" });
    const attacker = await userRepo.create({ email: "cram-attacker1@example.com", passwordHash: "h", displayName: "Attacker" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Owner's set" });

    await expect(
      setExamDate(setRepo, set.id, attacker.id, new Date("2026-12-01T00:00:00Z"), new Date("2026-08-01T00:00:00Z")),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const untouched = await setRepo.findById(set.id);
    expect(untouched!.examDate).toBeNull();
  });

  test("setExamDate: unknown set id throws NotFoundError", async () => {
    const owner = await userRepo.create({ email: "cram-owner2@example.com", passwordHash: "h", displayName: "Owner2" });
    await expect(setExamDate(setRepo, "does-not-exist", owner.id, new Date("2026-12-01T00:00:00Z"))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  test("setExamDate: rejects a date in the past", async () => {
    const owner = await userRepo.create({ email: "cram-owner3@example.com", passwordHash: "h", displayName: "Owner3" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Set 3" });
    await expect(
      setExamDate(setRepo, set.id, owner.id, new Date("2020-01-01T00:00:00Z"), new Date("2026-08-01T00:00:00Z")),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("setExamDate: accepts today's date regardless of the time-of-day component of `now`", async () => {
    // Regression test for a real bug: examDate arrives as a UTC-midnight Date
    // (parsed from an <input type=date> "YYYY-MM-DD" value), but `now` at
    // request time carries a real clock time, not midnight. A prior version
    // of this check derived `today` from `now`'s *local* Y/M/D and compared
    // epoch ms against `examDate`'s UTC midnight — in any server timezone
    // west of UTC, that wrongly rejected a student setting today's own date.
    // The fix compares UTC calendar-date STRINGS on both sides, so the
    // time-of-day and timezone of `now` can no longer matter.
    const owner = await userRepo.create({ email: "cram-owner-today@example.com", passwordHash: "h", displayName: "Today" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Today set" });
    const today = new Date("2026-08-01T00:00:00Z"); // examDate: today, UTC midnight
    const nowLateInDay = new Date("2026-08-01T23:59:00Z"); // "now" almost a full day later, same calendar date
    const updated = await setExamDate(setRepo, set.id, owner.id, today, nowLateInDay);
    expect(updated.examDate?.toISOString().slice(0, 10)).toBe("2026-08-01");
  });

  test("setExamDate: owner can set then clear, and clearing returns to null (normal scheduling)", async () => {
    const owner = await userRepo.create({ email: "cram-owner4@example.com", passwordHash: "h", displayName: "Owner4" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Set 4" });
    const now = new Date("2026-08-01T00:00:00Z");

    const withDate = await setExamDate(setRepo, set.id, owner.id, new Date("2026-09-01T00:00:00Z"), now);
    expect(withDate.examDate?.toISOString()).toBe("2026-09-01T00:00:00.000Z");

    const cleared = await setExamDate(setRepo, set.id, owner.id, null, now);
    expect(cleared.examDate).toBeNull();
  });

  test("previewCramSession / startCramSession: owner-only — non-owner is rejected", async () => {
    const owner = await userRepo.create({ email: "cram-owner5@example.com", passwordHash: "h", displayName: "Owner5" });
    const attacker = await userRepo.create({ email: "cram-attacker5@example.com", passwordHash: "h", displayName: "Attacker5" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Set 5" });
    await setExamDate(setRepo, set.id, owner.id, new Date("2026-12-01T00:00:00Z"), new Date("2026-08-01T00:00:00Z"));

    await expect(
      previewCramSession(cardRepo, setRepo, schedulers, set.id, attacker.id, owner.schedulerPreference),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      startCramSession(cardRepo, setRepo, schedulers, set.id, attacker.id, owner.schedulerPreference),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("previewCramSession: a set with no examDate is inactive (daysUntilExam null, nothing selected)", async () => {
    const owner = await userRepo.create({ email: "cram-owner6@example.com", passwordHash: "h", displayName: "Owner6" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Set 6" });
    await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f", back: "b" } });

    const summary = await previewCramSession(cardRepo, setRepo, schedulers, set.id, owner.id, owner.schedulerPreference);
    expect(summary.daysUntilExam).toBeNull();
    expect(summary.selectedCount).toBe(0);
    expect(summary.deprioritizedCount).toBe(0);
  });

  test("startCramSession: returns real Cards in priority order, and reviewing one goes through the normal submitReview path", async () => {
    const owner = await userRepo.create({ email: "cram-owner7@example.com", passwordHash: "h", displayName: "Owner7" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Set 7" });
    const now = new Date("2026-08-01T00:00:00Z");
    await setExamDate(setRepo, set.id, owner.id, new Date("2026-08-03T00:00:00Z"), now);

    const card1 = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f1", back: "b1" } });
    await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f2", back: "b2" } });

    const session = await startCramSession(cardRepo, setRepo, schedulers, set.id, owner.id, owner.schedulerPreference, now);
    expect(session.daysUntilExam).toBe(2);
    expect(session.cards.length).toBeGreaterThan(0);
    expect(session.cards.map((c) => c.id)).toContain(card1.id);

    // Confirm no ReviewState exists yet — startCramSession must not have written anything.
    expect(await sm2Scheduler.get(card1.id, owner.id)).toBeNull();

    // A review of a cram-selected card goes through the EXACT same
    // submitReview() usecase as any normal review — this is the safety
    // property the slice spec requires: cram mode never introduces a
    // parallel review-submission path.
    const result = (await submitReview(schedulers, {
      cardId: card1.id,
      userId: owner.id,
      quality: 4,
      schedulerPreference: owner.schedulerPreference,
      now,
    })) as ReviewState;
    expect(result.repetitions).toBe(1);

    const persisted = await sm2Scheduler.get(card1.id, owner.id);
    expect(persisted).not.toBeNull();
    expect(persisted!.repetitions).toBe(1);
  });
});

describe("cramUsecases: static safety-constraint check", () => {
  test("neither cramUsecases.ts nor cramPlanner.ts ever calls scheduler.upsert — only reviewUsecases.ts's submitReview writes ReviewState/FsrsReviewState from an ANSWER", async () => {
    const cramUsecasesSrc = await Bun.file(new URL("../src/core/usecases/cramUsecases.ts", import.meta.url)).text();
    const cramPlannerSrc = await Bun.file(new URL("../src/core/domain/cramPlanner.ts", import.meta.url)).text();
    expect(cramUsecasesSrc).not.toContain(".upsert(");
    expect(cramPlannerSrc).not.toContain(".upsert(");

    // Confirm .upsert( on a SchedulerPort only appears in the sanctioned
    // writer(s) across the whole usecases layer. reviewUsecases.ts's
    // submitReview is the one answer-driven scheduling-update path (this
    // is what cram mode — the slice this file was written for — must never
    // duplicate: card *selection* only, never a second scoring path).
    //
    // Slice 15 adds ONE more sanctioned writer, liveQuizPostGameUsecases.ts,
    // for a DIFFERENT reason that doesn't weaken this constraint: it never
    // grades an answer or computes an SM-2/FSRS quality-based transition —
    // it only SEEDS a brand-new card's initial state (the same
    // sm2InitialState()/fsrsInitialState() baseline a genuinely
    // never-reviewed card already has), with nothing but a shortened
    // `dueAt`. The card behaves completely normally through the real
    // submitReview path on its next actual review afterward — see
    // tests/liveQuizPostGameReview.test.ts's explicit regression proof.
    const glob = new Bun.Glob("*.ts");
    const writers: string[] = [];
    for await (const file of glob.scan({ cwd: new URL("../src/core/usecases/", import.meta.url).pathname })) {
      const text = await Bun.file(new URL(`../src/core/usecases/${file}`, import.meta.url)).text();
      if (text.includes("scheduler.upsert(") || /\.upsert\(\s*(next|state)\s*\)/.test(text)) {
        writers.push(file);
      }
    }
    expect(writers.sort()).toEqual(["liveQuizPostGameUsecases.ts", "reviewUsecases.ts"]);
  });
});
