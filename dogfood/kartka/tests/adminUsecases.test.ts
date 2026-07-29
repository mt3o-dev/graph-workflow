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
import { createLlmCallLogRepoSqlite } from "../src/adapters/db/llmCallLogRepo.sqlite";
import { createAuthAdapterSqlite } from "../src/adapters/auth/authAdapter.sqlite";
import { createSet } from "../src/core/usecases/setUsecases";
import { addCard } from "../src/core/usecases/cardUsecases";
import { login, BannedUserError } from "../src/core/usecases/authUsecases";
import {
  listUsersForAdmin,
  setUserBanned,
  listSetsForAdmin,
  deleteSetAsAdmin,
  listCardsForAdmin,
  deleteCardAsAdmin,
  getAdminAnalytics,
  type AdminActor,
} from "../src/core/usecases/adminUsecases";
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from "../src/core/domain/errors";

const dbPath = `./data/test-admin-${crypto.randomUUID()}.db`;
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

const userRepo = createUserRepoSqlite(db as never);
const setRepo = createSetRepoSqlite(db as never);
const cardRepo = createCardRepoSqlite(db as never);
const scheduler = createSchedulerRepoSqlite(db as never);
const llmCallLogRepo = createLlmCallLogRepoSqlite(db as never);
const auth = createAuthAdapterSqlite(db as never, "test-secret");

function asActor(u: { id: string; role: "student" | "admin" }): AdminActor {
  return { id: u.id, role: u.role };
}

describe("adminUsecases (sqlite driver, temp db)", () => {
  test("non-admin actors are rejected by every admin usecase", async () => {
    await migrateSqlite(db as never);

    const student = await userRepo.create({ email: "student-reject@example.com", passwordHash: "h", displayName: "Student" });
    const admin = await userRepo.create({ email: "admin-seed@example.com", passwordHash: "h", displayName: "Admin", role: "admin" });
    const set = await createSet(setRepo, { ownerId: student.id, title: "Some set" });
    const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: student.id, type: "basic", payload: { front: "f", back: "b" } });

    const studentActor = asActor(student);
    const query = { page: 1, pageSize: 10, sortBy: "createdAt", sortDir: "desc" as const };

    await expect(listUsersForAdmin(userRepo, studentActor, query)).rejects.toThrow(ForbiddenError);
    await expect(setUserBanned(userRepo, studentActor, admin.id, true)).rejects.toThrow(ForbiddenError);
    await expect(listSetsForAdmin(setRepo, studentActor, query)).rejects.toThrow(ForbiddenError);
    await expect(deleteSetAsAdmin(setRepo, studentActor, set.id)).rejects.toThrow(ForbiddenError);
    await expect(listCardsForAdmin(cardRepo, setRepo, studentActor, set.id, query)).rejects.toThrow(ForbiddenError);
    await expect(deleteCardAsAdmin(cardRepo, studentActor, card.id)).rejects.toThrow(ForbiddenError);
    await expect(getAdminAnalytics(scheduler, llmCallLogRepo, studentActor)).rejects.toThrow(ForbiddenError);

    // Nothing was actually touched by the rejected calls.
    expect(await setRepo.findById(set.id)).not.toBeNull();
    expect(await cardRepo.findById(card.id)).not.toBeNull();
  });

  test("an admin actor can list users/sets and drill into a set's cards regardless of ownership", async () => {
    const owner = await userRepo.create({ email: "owner-list@example.com", passwordHash: "h", displayName: "Owner" });
    const admin = await userRepo.create({ email: "admin-list@example.com", passwordHash: "h", displayName: "Admin List", role: "admin" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Owner's set" });
    await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f", back: "b" } });

    const adminActor = asActor(admin);
    const query = { page: 1, pageSize: 50, sortBy: "createdAt", sortDir: "desc" as const };

    const users = await listUsersForAdmin(userRepo, adminActor, query);
    expect(users.items.some((u) => u.id === owner.id)).toBe(true);

    const sets = await listSetsForAdmin(setRepo, adminActor, query);
    const listedSet = sets.items.find((s) => s.id === set.id);
    expect(listedSet).toBeDefined();
    expect(listedSet!.ownerDisplayName).toBe("Owner");
    expect(listedSet!.cardCount).toBe(1);

    const cardsView = await listCardsForAdmin(cardRepo, setRepo, adminActor, set.id, query);
    expect(cardsView.set.id).toBe(set.id);
    expect(cardsView.data.items).toHaveLength(1);
  });

  describe("deleteSetAsAdmin / deleteCardAsAdmin: bypass ownership, don't corrupt it", () => {
    test("admin can delete a set they do not own", async () => {
      const owner = await userRepo.create({ email: "owner-del-set@example.com", passwordHash: "h", displayName: "Owner" });
      const admin = await userRepo.create({ email: "admin-del-set@example.com", passwordHash: "h", displayName: "Admin", role: "admin" });
      const set = await createSet(setRepo, { ownerId: owner.id, title: "To be deleted" });

      const deleted = await deleteSetAsAdmin(setRepo, asActor(admin), set.id);
      expect(deleted.ownerId).toBe(owner.id); // returned set still reports the REAL owner, never the admin

      expect(await setRepo.findById(set.id)).toBeNull();
    });

    test("deleteSetAsAdmin 404s for an unknown set id", async () => {
      const admin = await userRepo.create({ email: "admin-404-set@example.com", passwordHash: "h", displayName: "Admin", role: "admin" });
      await expect(deleteSetAsAdmin(setRepo, asActor(admin), "not-a-real-id")).rejects.toThrow(NotFoundError);
    });

    test("admin can delete a card in a set they do not own", async () => {
      const owner = await userRepo.create({ email: "owner-del-card@example.com", passwordHash: "h", displayName: "Owner" });
      const admin = await userRepo.create({ email: "admin-del-card@example.com", passwordHash: "h", displayName: "Admin", role: "admin" });
      const set = await createSet(setRepo, { ownerId: owner.id, title: "Card owner set" });
      const card = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f", back: "b" } });

      const deleted = await deleteCardAsAdmin(cardRepo, asActor(admin), card.id);
      expect(deleted.id).toBe(card.id);
      expect(await cardRepo.findById(card.id)).toBeNull();
    });
  });

  describe("setUserBanned: self-ban + last-admin lockout guards", () => {
    test("an admin cannot change their own ban status", async () => {
      const admin = await userRepo.create({ email: "self-ban@example.com", passwordHash: "h", displayName: "Self", role: "admin" });
      await expect(setUserBanned(userRepo, asActor(admin), admin.id, true)).rejects.toThrow(ValidationError);
    });

    // Note on when this guard actually fires: since self-ban is blocked above,
    // and an actor authorized via requireAdminApi/assertAdmin is always
    // role="admin", a *normal* acting admin always remains counted as "still
    // active" after banning someone else — so the active-admin count can
    // never legitimately hit zero through a normal admin session alone. The
    // guard's real job is defense-in-depth: it models the actor purely as
    // "role=admin, currently banned" without relying on how that state was
    // reached. (getCurrentUser now rejects a banned user's session on next
    // lookup — see session.ts — so this scenario can no longer be reached via
    // a live HTTP request; the guard stays anyway as a usecase-level
    // invariant that doesn't depend on the session layer enforcing it.) This
    // test reproduces exactly that: an actor with role="admin" who is ALSO
    // already banned, attempting to ban the one remaining active admin —
    // which must be refused, or admin access would be lockable-out entirely.
    // Isolated db so pre-existing admins from earlier tests in this file
    // can't interfere with the "sole active admin" premise.
    test("a stale-session banned-admin actor cannot ban the sole remaining active admin", async () => {
      const lockoutDbPath = `./data/test-admin-lockout-${crypto.randomUUID()}.db`;
      const lockoutSqlite = new Database(lockoutDbPath, { create: true });
      const lockoutDb = drizzle(lockoutSqlite, { schema });
      await migrateSqlite(lockoutDb as never);
      const lockoutUserRepo = createUserRepoSqlite(lockoutDb as never);

      const soleActiveAdmin = await lockoutUserRepo.create({
        email: "lockout-sole-admin@example.com",
        passwordHash: "h",
        displayName: "Sole",
        role: "admin",
      });
      const staleAdmin = await lockoutUserRepo.create({
        email: "lockout-stale-admin@example.com",
        passwordHash: "h",
        displayName: "Stale",
        role: "admin",
      });
      await lockoutUserRepo.setBanned(staleAdmin.id, true); // simulate: already banned, but session still valid

      await expect(setUserBanned(lockoutUserRepo, asActor(staleAdmin), soleActiveAdmin.id, true)).rejects.toThrow(ConflictError);

      const stillActive = await lockoutUserRepo.findById(soleActiveAdmin.id);
      expect(stillActive!.banned).toBe(false);

      lockoutSqlite.close();
      try {
        unlinkSync(lockoutDbPath);
        unlinkSync(`${lockoutDbPath}-shm`);
        unlinkSync(`${lockoutDbPath}-wal`);
      } catch {
        // best-effort cleanup
      }
    });

    test("banning an admin when other active admins remain succeeds", async () => {
      const admin1 = await userRepo.create({ email: "multi-admin-1@example.com", passwordHash: "h", displayName: "A1", role: "admin" });
      const admin2 = await userRepo.create({ email: "multi-admin-2@example.com", passwordHash: "h", displayName: "A2", role: "admin" });

      const banned = await setUserBanned(userRepo, asActor(admin1), admin2.id, true);
      expect(banned.banned).toBe(true);
    });

    test("banning a student always succeeds regardless of admin headcount", async () => {
      const admin = await userRepo.create({ email: "ban-student-admin@example.com", passwordHash: "h", displayName: "Admin", role: "admin" });
      const student = await userRepo.create({ email: "ban-student@example.com", passwordHash: "h", displayName: "Student" });

      const banned = await setUserBanned(userRepo, asActor(admin), student.id, true);
      expect(banned.banned).toBe(true);

      const unbanned = await setUserBanned(userRepo, asActor(admin), student.id, false);
      expect(unbanned.banned).toBe(false);
    });

    test("setUserBanned 404s for an unknown user id", async () => {
      const admin = await userRepo.create({ email: "ban-404@example.com", passwordHash: "h", displayName: "Admin", role: "admin" });
      await expect(setUserBanned(userRepo, asActor(admin), "not-a-real-id", true)).rejects.toThrow(NotFoundError);
    });
  });

  describe("ban blocks login (slice 1's authUsecases.login, re-verified here for the admin moderation path)", () => {
    test("a banned user cannot log in even with the correct password", async () => {
      const passwordHash = await auth.hashPassword("correct-horse-battery-staple");
      const target = await userRepo.create({ email: "banned-login@example.com", passwordHash, displayName: "Banned" });
      const admin = await userRepo.create({ email: "banned-login-admin@example.com", passwordHash: "h", displayName: "Admin", role: "admin" });

      await setUserBanned(userRepo, asActor(admin), target.id, true);

      await expect(login(userRepo, auth, { email: "banned-login@example.com", password: "correct-horse-battery-staple" })).rejects.toThrow(
        BannedUserError,
      );
    });

    test("unbanning restores login", async () => {
      const passwordHash = await auth.hashPassword("another-correct-password");
      const target = await userRepo.create({ email: "unban-login@example.com", passwordHash, displayName: "Unbanned" });
      const admin = await userRepo.create({ email: "unban-login-admin@example.com", passwordHash: "h", displayName: "Admin", role: "admin" });

      await setUserBanned(userRepo, asActor(admin), target.id, true);
      await expect(login(userRepo, auth, { email: "unban-login@example.com", password: "another-correct-password" })).rejects.toThrow(
        BannedUserError,
      );

      await setUserBanned(userRepo, asActor(admin), target.id, false);
      const { user } = await login(userRepo, auth, { email: "unban-login@example.com", password: "another-correct-password" });
      expect(user.id).toBe(target.id);
    });
  });

  describe("getAdminAnalytics: active users / review volume proxies + LLM cost totals", () => {
    test("counts distinct active users and review_states rows within each window, and aggregates llm_call_log", async () => {
      const admin = await userRepo.create({ email: "analytics-admin@example.com", passwordHash: "h", displayName: "Admin", role: "admin" });
      const reviewer1 = await userRepo.create({ email: "reviewer1@example.com", passwordHash: "h", displayName: "R1" });
      const reviewer2 = await userRepo.create({ email: "reviewer2@example.com", passwordHash: "h", displayName: "R2" });
      const idleUser = await userRepo.create({ email: "idle@example.com", passwordHash: "h", displayName: "Idle" });

      const set = await createSet(setRepo, { ownerId: reviewer1.id, title: "Analytics set" });
      const card1 = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: reviewer1.id, type: "basic", payload: { front: "f1", back: "b1" } });
      const card2 = await addCard(cardRepo, setRepo, { setId: set.id, ownerId: reviewer1.id, type: "basic", payload: { front: "f2", back: "b2" } });

      const now = new Date("2026-06-15T12:00:00Z");
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      // reviewer1: two cards reviewed within the last 7 days -> 1 active user, 2 review_states rows in-window.
      await scheduler.upsert({ cardId: card1.id, userId: reviewer1.id, easiness: 2.5, interval: 1, repetitions: 1, dueAt: now, lastReviewedAt: twoDaysAgo });
      await scheduler.upsert({ cardId: card2.id, userId: reviewer1.id, easiness: 2.5, interval: 1, repetitions: 1, dueAt: now, lastReviewedAt: twoDaysAgo });
      // reviewer2: reviewed 20 days ago -> counts in the 30d window but not the 7d window.
      await scheduler.upsert({ cardId: card1.id, userId: reviewer2.id, easiness: 2.5, interval: 1, repetitions: 1, dueAt: now, lastReviewedAt: twentyDaysAgo });
      // idleUser: reviewed 60 days ago -> outside both windows.
      await scheduler.upsert({ cardId: card2.id, userId: idleUser.id, easiness: 2.5, interval: 1, repetitions: 1, dueAt: now, lastReviewedAt: sixtyDaysAgo });

      await llmCallLogRepo.logCall({
        userId: reviewer1.id,
        model: "anthropic/claude-3.5-haiku",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.0006,
        status: "success",
        errorMessage: null,
      });
      await llmCallLogRepo.logCall({
        userId: reviewer1.id,
        model: "openai/gpt-4o-mini",
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        estimatedCostUsd: 0.00009,
        status: "success",
        errorMessage: null,
      });

      const analytics = await getAdminAnalytics(scheduler, llmCallLogRepo, asActor(admin), now);

      expect(analytics.activeUsers7d).toBe(1); // reviewer1 only
      expect(analytics.activeUsers30d).toBe(2); // reviewer1 + reviewer2
      expect(analytics.reviewsLast7d).toBe(2); // reviewer1's two review_states rows
      expect(analytics.reviewsLast30d).toBe(3); // + reviewer2's one row

      expect(analytics.llm.totals.callCount).toBe(2);
      expect(analytics.llm.totals.totalTokens).toBe(450);
      expect(analytics.llm.byModel.map((m) => m.model).sort()).toEqual(["anthropic/claude-3.5-haiku", "openai/gpt-4o-mini"].sort());
    });
  });
});
