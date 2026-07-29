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
import { createPushSubscriptionRepoSqlite } from "../src/adapters/db/pushSubscriptionRepo.sqlite";
import { createSet } from "../src/core/usecases/setUsecases";
import { addCard } from "../src/core/usecases/cardUsecases";
import {
  subscribeToPush,
  unsubscribeFromPush,
  sendDueReminders,
} from "../src/core/usecases/reminderUsecases";
import type { Schedulers } from "../src/core/usecases/reviewUsecases";
import type { WebPushPort, WebPushSendResult } from "../src/core/ports/webPushPort";

const dbPath = `./data/test-reminders-${crypto.randomUUID()}.db`;
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
const pushSubscriptionRepo = createPushSubscriptionRepoSqlite(db as never);
const schedulers: Schedulers = { sm2: sm2Scheduler, fsrs: fsrsScheduler };

await migrateSqlite(db as never);

describe("push subscription ownership", () => {
  test("subscribeToPush always writes to the requesting user's own id", async () => {
    const owner = await userRepo.create({ email: "sub-owner1@example.com", passwordHash: "h", displayName: "Owner" });
    const sub = await subscribeToPush(pushSubscriptionRepo, owner.id, {
      endpoint: "https://push.example.com/ep-1",
      p256dhKey: "p256dh-1",
      authKey: "auth-1",
    });
    expect(sub.userId).toBe(owner.id);

    const listed = await pushSubscriptionRepo.listByUser(owner.id);
    expect(listed.map((s) => s.endpoint)).toContain("https://push.example.com/ep-1");
  });

  test("a user cannot unsubscribe another user's subscription by supplying their endpoint", async () => {
    const victim = await userRepo.create({ email: "sub-victim1@example.com", passwordHash: "h", displayName: "Victim" });
    const attacker = await userRepo.create({ email: "sub-attacker1@example.com", passwordHash: "h", displayName: "Attacker" });

    await subscribeToPush(pushSubscriptionRepo, victim.id, {
      endpoint: "https://push.example.com/victim-ep",
      p256dhKey: "p256dh-v",
      authKey: "auth-v",
    });

    // Attacker knows (guessed/observed) the victim's endpoint and tries to
    // unsubscribe it under their own session.
    const removed = await unsubscribeFromPush(pushSubscriptionRepo, attacker.id, "https://push.example.com/victim-ep");
    expect(removed).toBe(false);

    // The victim's subscription is untouched.
    const stillThere = await pushSubscriptionRepo.listByUser(victim.id);
    expect(stillThere.map((s) => s.endpoint)).toContain("https://push.example.com/victim-ep");
  });

  test("a user CAN unsubscribe their own subscription by its own endpoint", async () => {
    const owner = await userRepo.create({ email: "sub-owner2@example.com", passwordHash: "h", displayName: "Owner2" });
    await subscribeToPush(pushSubscriptionRepo, owner.id, {
      endpoint: "https://push.example.com/owner2-ep",
      p256dhKey: "p256dh-2",
      authKey: "auth-2",
    });

    const removed = await unsubscribeFromPush(pushSubscriptionRepo, owner.id, "https://push.example.com/owner2-ep");
    expect(removed).toBe(true);

    const remaining = await pushSubscriptionRepo.listByUser(owner.id);
    expect(remaining).toEqual([]);
  });
});

describe("sendDueReminders", () => {
  test("notifies a user with due cards and a subscription; skips a user with none due", async () => {
    const dueUser = await userRepo.create({ email: "reminder-due1@example.com", passwordHash: "h", displayName: "Due" });
    const idleUser = await userRepo.create({ email: "reminder-idle1@example.com", passwordHash: "h", displayName: "Idle" });

    const dueSet = await createSet(setRepo, { ownerId: dueUser.id, title: "Due set" });
    await addCard(cardRepo, setRepo, {
      setId: dueSet.id,
      ownerId: dueUser.id,
      type: "basic",
      payload: { front: "Q", back: "A" },
    });

    // idleUser has a subscription but no cards at all -> zero due cards.
    await subscribeToPush(pushSubscriptionRepo, dueUser.id, {
      endpoint: "https://push.example.com/due1",
      p256dhKey: "k",
      authKey: "a",
    });
    await subscribeToPush(pushSubscriptionRepo, idleUser.id, {
      endpoint: "https://push.example.com/idle1",
      p256dhKey: "k",
      authKey: "a",
    });

    const sent: string[] = [];
    const fakeWebPush: WebPushPort = {
      async send(subscription): Promise<WebPushSendResult> {
        sent.push(subscription.endpoint);
        return { ok: true, expired: false };
      },
    };

    const result = await sendDueReminders({
      userRepo,
      cardRepo,
      schedulers,
      pushSubscriptionRepo,
      webPush: fakeWebPush,
      buildPayload: (count) => JSON.stringify({ body: `You have ${count} cards due` }),
      now: new Date("2026-01-01T12:00:00Z"),
    });

    expect(result.notifiedUsers).toBe(1);
    expect(result.sentNotifications).toBe(1);
    expect(sent).toEqual(["https://push.example.com/due1"]);
  });

  test("respects quiet hours — a user inside their quiet window is not notified even with due cards", async () => {
    const user = await userRepo.create({ email: "reminder-quiet1@example.com", passwordHash: "h", displayName: "Quiet" });
    const set = await createSet(setRepo, { ownerId: user.id, title: "Quiet set" });
    await addCard(cardRepo, setRepo, {
      setId: set.id,
      ownerId: user.id,
      type: "basic",
      payload: { front: "Q", back: "A" },
    });
    await userRepo.updateQuietHours(user.id, "22:00", "07:00");
    await subscribeToPush(pushSubscriptionRepo, user.id, {
      endpoint: "https://push.example.com/quiet1",
      p256dhKey: "k",
      authKey: "a",
    });

    // Tracks which endpoints actually got a send call — used instead of the
    // aggregate result counts below, since this shared temp db accumulates
    // subscriptions/due cards from earlier tests in this file (other users'
    // subscriptions are legitimately notified in the same pass and would
    // throw off a global "notifiedUsers === 0" assertion).
    const sent: string[] = [];
    const fakeWebPush: WebPushPort = {
      async send(subscription): Promise<WebPushSendResult> {
        sent.push(subscription.endpoint);
        return { ok: true, expired: false };
      },
    };

    // 23:30 UTC — inside the 22:00-07:00 quiet window.
    await sendDueReminders({
      userRepo,
      cardRepo,
      schedulers,
      pushSubscriptionRepo,
      webPush: fakeWebPush,
      buildPayload: (count) => JSON.stringify({ body: `You have ${count} cards due` }),
      now: new Date("2026-01-01T23:30:00Z"),
    });

    expect(sent).not.toContain("https://push.example.com/quiet1");
  });

  test("an expired (410) subscription is deleted and not counted as sent", async () => {
    const user = await userRepo.create({ email: "reminder-expired1@example.com", passwordHash: "h", displayName: "Expired" });
    const set = await createSet(setRepo, { ownerId: user.id, title: "Expired set" });
    await addCard(cardRepo, setRepo, {
      setId: set.id,
      ownerId: user.id,
      type: "basic",
      payload: { front: "Q", back: "A" },
    });
    await subscribeToPush(pushSubscriptionRepo, user.id, {
      endpoint: "https://push.example.com/expired1",
      p256dhKey: "k",
      authKey: "a",
    });

    // Only THIS test's endpoint should report expired (410) — every other
    // subscription in this shared db sends fine, isolating the assertion
    // below to just this test's own subscription regardless of what else
    // has accumulated from earlier tests in this file.
    const fakeWebPush: WebPushPort = {
      async send(subscription): Promise<WebPushSendResult> {
        if (subscription.endpoint === "https://push.example.com/expired1") {
          return { ok: false, expired: true }; // simulates a 410 Gone from the push service
        }
        return { ok: true, expired: false };
      },
    };

    await sendDueReminders({
      userRepo,
      cardRepo,
      schedulers,
      pushSubscriptionRepo,
      webPush: fakeWebPush,
      buildPayload: (count) => JSON.stringify({ body: `You have ${count} cards due` }),
      now: new Date("2026-01-01T12:00:00Z"),
    });

    const remaining = await pushSubscriptionRepo.listByUser(user.id);
    expect(remaining).toEqual([]); // the expired subscription was deleted
  });
});
