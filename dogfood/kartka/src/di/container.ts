import "../env"; // validate env before anything else in the app boots
import { ENV } from "varlock/env";
import { getDb, getDriver, migrate, type SqliteDb, type PgDb } from "../adapters/db/index";
import type { SetRepoPort } from "../core/ports/setRepoPort";
import type { CardRepoPort } from "../core/ports/cardRepoPort";
import type { UserRepoPort } from "../core/ports/userRepoPort";
import type { Sm2SchedulerPort, FsrsSchedulerPort } from "../core/ports/schedulerPort";
import type { AuthPort } from "../core/ports/authPort";
import type { LlmCallLogRepoPort } from "../core/ports/llmCallLogRepoPort";
import type { LlmGeneratorPort } from "../core/ports/llmGeneratorPort";
import type { PushSubscriptionRepoPort } from "../core/ports/pushSubscriptionRepoPort";
import type { WebPushPort } from "../core/ports/webPushPort";
import type { LiveSessionPort } from "../core/ports/liveSessionPort";
import { createInMemoryLiveSessionPort } from "../adapters/liveQuiz/inMemoryLiveSessionPort";
import type { LiveStreakBonusRepoPort } from "../core/ports/liveStreakBonusRepoPort";
import type { LiveQuizInsightsRepoPort } from "../core/ports/liveQuizInsightsRepoPort";

export interface Container {
  setRepo: SetRepoPort;
  cardRepo: CardRepoPort;
  userRepo: UserRepoPort;
  /** SM-2 scheduler (slice 1). See fsrsScheduler for the opt-in slice-5 alternative. */
  scheduler: Sm2SchedulerPort;
  /** FSRS scheduler (slice 5) — see core/ports/schedulerPort.ts and reviewUsecases.ts. */
  fsrsScheduler: FsrsSchedulerPort;
  auth: AuthPort;
  llmCallLogRepo: LlmCallLogRepoPort;
  /** undefined when OPENROUTER_API_KEY isn't set — callers must show a "not configured" state, not crash. */
  llmGenerator: LlmGeneratorPort | undefined;
  /** Slice 9 (due-card reminders) — Web Push subscription storage. */
  pushSubscriptionRepo: PushSubscriptionRepoPort;
  /** Slice 9 — VAPID-signed push delivery, always configured (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are @required in .env.schema, dev defaults ship). */
  webPush: WebPushPort;
  /**
   * Slice 11 (live quiz) — in-memory room storage, single-instance MVP (see
   * docs/ADR-live-transport.md). IMPORTANT: this Map lives in whichever
   * process calls getContainer() first. Room create/join/answer/advance
   * must all be handled by the SAME process (the WebSocket sidecar,
   * live-server.ts) — never split between it and the main Astro server, or
   * rooms silently "don't exist" in the other process.
   */
  liveSessionPort: LiveSessionPort;
  /** Slice 14 (live-quiz streak bonus) — durable pending/confirmed/forfeited bonus records; see liveStreakBonusRepoPort.ts. */
  liveStreakBonusRepo: LiveStreakBonusRepoPort;
  /** Slice 16 (live-quiz teacher insights) — durable per-round/per-player/per-question outcome records; see liveQuizInsightsRepoPort.ts. */
  liveQuizInsightsRepo: LiveQuizInsightsRepoPort;
  seedAdminIfNeeded(): Promise<void>;
}

let containerPromise: Promise<Container> | undefined;

async function buildContainer(): Promise<Container> {
  await migrate();
  const db = await getDb();
  const driver = getDriver();

  let setRepo: SetRepoPort;
  let cardRepo: CardRepoPort;
  let userRepo: UserRepoPort;
  let scheduler: Sm2SchedulerPort;
  let fsrsScheduler: FsrsSchedulerPort;
  let auth: AuthPort;
  let llmCallLogRepo: LlmCallLogRepoPort;
  let pushSubscriptionRepo: PushSubscriptionRepoPort;
  let liveStreakBonusRepo: LiveStreakBonusRepoPort;
  let liveQuizInsightsRepo: LiveQuizInsightsRepoPort;

  if (driver === "postgres") {
    const { createSetRepoPg } = await import("../adapters/db/setRepo.pg");
    const { createCardRepoPg } = await import("../adapters/db/cardRepo.pg");
    const { createUserRepoPg } = await import("../adapters/db/userRepo.pg");
    const { createSchedulerRepoPg } = await import("../adapters/db/schedulerRepo.pg");
    const { createFsrsSchedulerRepoPg } = await import("../adapters/db/fsrsSchedulerRepo.pg");
    const { createAuthAdapterPg } = await import("../adapters/auth/authAdapter.pg");
    const { createLlmCallLogRepoPg } = await import("../adapters/db/llmCallLogRepo.pg");
    const { createPushSubscriptionRepoPg } = await import("../adapters/db/pushSubscriptionRepo.pg");
    const { createLiveStreakBonusRepoPg } = await import("../adapters/db/liveStreakBonusRepo.pg");
    const { createLiveQuizInsightsRepoPg } = await import("../adapters/db/liveQuizInsightsRepo.pg");
    const pgDb = db as PgDb;
    setRepo = createSetRepoPg(pgDb);
    cardRepo = createCardRepoPg(pgDb);
    userRepo = createUserRepoPg(pgDb);
    scheduler = createSchedulerRepoPg(pgDb);
    fsrsScheduler = createFsrsSchedulerRepoPg(pgDb);
    auth = createAuthAdapterPg(pgDb, ENV.SESSION_SECRET);
    llmCallLogRepo = createLlmCallLogRepoPg(pgDb);
    pushSubscriptionRepo = createPushSubscriptionRepoPg(pgDb);
    liveStreakBonusRepo = createLiveStreakBonusRepoPg(pgDb);
    liveQuizInsightsRepo = createLiveQuizInsightsRepoPg(pgDb);
  } else {
    const { createSetRepoSqlite } = await import("../adapters/db/setRepo.sqlite");
    const { createCardRepoSqlite } = await import("../adapters/db/cardRepo.sqlite");
    const { createUserRepoSqlite } = await import("../adapters/db/userRepo.sqlite");
    const { createSchedulerRepoSqlite } = await import("../adapters/db/schedulerRepo.sqlite");
    const { createFsrsSchedulerRepoSqlite } = await import("../adapters/db/fsrsSchedulerRepo.sqlite");
    const { createAuthAdapterSqlite } = await import("../adapters/auth/authAdapter.sqlite");
    const { createLlmCallLogRepoSqlite } = await import("../adapters/db/llmCallLogRepo.sqlite");
    const { createPushSubscriptionRepoSqlite } = await import("../adapters/db/pushSubscriptionRepo.sqlite");
    const { createLiveStreakBonusRepoSqlite } = await import("../adapters/db/liveStreakBonusRepo.sqlite");
    const { createLiveQuizInsightsRepoSqlite } = await import("../adapters/db/liveQuizInsightsRepo.sqlite");
    const sqliteDb = db as SqliteDb;
    setRepo = createSetRepoSqlite(sqliteDb);
    cardRepo = createCardRepoSqlite(sqliteDb);
    userRepo = createUserRepoSqlite(sqliteDb);
    scheduler = createSchedulerRepoSqlite(sqliteDb);
    fsrsScheduler = createFsrsSchedulerRepoSqlite(sqliteDb);
    auth = createAuthAdapterSqlite(sqliteDb, ENV.SESSION_SECRET);
    llmCallLogRepo = createLlmCallLogRepoSqlite(sqliteDb);
    pushSubscriptionRepo = createPushSubscriptionRepoSqlite(sqliteDb);
    liveStreakBonusRepo = createLiveStreakBonusRepoSqlite(sqliteDb);
    liveQuizInsightsRepo = createLiveQuizInsightsRepoSqlite(sqliteDb);
  }

  const { createWebPushAdapter } = await import("../adapters/push/webPushAdapter");
  const webPush = createWebPushAdapter({
    subject: ENV.VAPID_CONTACT || "mailto:admin@kartka.local",
    publicKey: ENV.VAPID_PUBLIC_KEY,
    privateKey: ENV.VAPID_PRIVATE_KEY,
  });

  let llmGenerator: LlmGeneratorPort | undefined;
  if (ENV.OPENROUTER_API_KEY) {
    const { createOpenRouterAdapter } = await import("../adapters/llm/openRouterAdapter");
    llmGenerator = createOpenRouterAdapter(
      { apiKey: ENV.OPENROUTER_API_KEY, model: ENV.OPENROUTER_MODEL || "anthropic/claude-3.5-haiku" },
      llmCallLogRepo,
    );
  }

  async function seedAdminIfNeeded(): Promise<void> {
    const existingCount = await userRepo.count();
    if (existingCount > 0) return;

    const generatedPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const passwordHash = await auth.hashPassword(generatedPassword);
    const admin = await userRepo.create({
      email: "admin@kartka.local",
      passwordHash,
      displayName: "Kartka Admin",
      role: "admin",
      locale: "pl",
    });
    // Intentionally the ONLY place we ever log a plaintext credential — logged
    // once on first boot so an operator can log in; never persisted anywhere.
    // eslint-disable-next-line no-console
    console.log(
      [
        "",
        "==================================================================",
        "Kartka: no users found — seeded a first admin account.",
        `  email:    ${admin.email}`,
        `  password: ${generatedPassword}`,
        "Log in once, then change the password (slice 1 has no self-service",
        "password change yet — see docs/TODO.md).",
        "==================================================================",
        "",
      ].join("\n"),
    );
  }

  await seedAdminIfNeeded();

  const liveSessionPort = createInMemoryLiveSessionPort();

  return {
    setRepo,
    cardRepo,
    userRepo,
    scheduler,
    fsrsScheduler,
    auth,
    llmCallLogRepo,
    llmGenerator,
    pushSubscriptionRepo,
    webPush,
    liveSessionPort,
    liveStreakBonusRepo,
    liveQuizInsightsRepo,
    seedAdminIfNeeded,
  };
}

/** The composition root singleton. Astro pages import `getContainer()`, never adapters directly. */
export function getContainer(): Promise<Container> {
  if (!containerPromise) containerPromise = buildContainer();
  return containerPromise;
}
