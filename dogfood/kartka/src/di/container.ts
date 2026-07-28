import "../env"; // validate env before anything else in the app boots
import { ENV } from "varlock/env";
import { getDb, getDriver, migrate, type SqliteDb, type PgDb } from "../adapters/db/index";
import type { SetRepoPort } from "../core/ports/setRepoPort";
import type { CardRepoPort } from "../core/ports/cardRepoPort";
import type { UserRepoPort } from "../core/ports/userRepoPort";
import type { SchedulerPort } from "../core/ports/schedulerPort";
import type { AuthPort } from "../core/ports/authPort";

export interface Container {
  setRepo: SetRepoPort;
  cardRepo: CardRepoPort;
  userRepo: UserRepoPort;
  scheduler: SchedulerPort;
  auth: AuthPort;
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
  let scheduler: SchedulerPort;
  let auth: AuthPort;

  if (driver === "postgres") {
    const { createSetRepoPg } = await import("../adapters/db/setRepo.pg");
    const { createCardRepoPg } = await import("../adapters/db/cardRepo.pg");
    const { createUserRepoPg } = await import("../adapters/db/userRepo.pg");
    const { createSchedulerRepoPg } = await import("../adapters/db/schedulerRepo.pg");
    const { createAuthAdapterPg } = await import("../adapters/auth/authAdapter.pg");
    const pgDb = db as PgDb;
    setRepo = createSetRepoPg(pgDb);
    cardRepo = createCardRepoPg(pgDb);
    userRepo = createUserRepoPg(pgDb);
    scheduler = createSchedulerRepoPg(pgDb);
    auth = createAuthAdapterPg(pgDb, ENV.SESSION_SECRET);
  } else {
    const { createSetRepoSqlite } = await import("../adapters/db/setRepo.sqlite");
    const { createCardRepoSqlite } = await import("../adapters/db/cardRepo.sqlite");
    const { createUserRepoSqlite } = await import("../adapters/db/userRepo.sqlite");
    const { createSchedulerRepoSqlite } = await import("../adapters/db/schedulerRepo.sqlite");
    const { createAuthAdapterSqlite } = await import("../adapters/auth/authAdapter.sqlite");
    const sqliteDb = db as SqliteDb;
    setRepo = createSetRepoSqlite(sqliteDb);
    cardRepo = createCardRepoSqlite(sqliteDb);
    userRepo = createUserRepoSqlite(sqliteDb);
    scheduler = createSchedulerRepoSqlite(sqliteDb);
    auth = createAuthAdapterSqlite(sqliteDb, ENV.SESSION_SECRET);
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

  return { setRepo, cardRepo, userRepo, scheduler, auth, seedAdminIfNeeded };
}

/** The composition root singleton. Astro pages import `getContainer()`, never adapters directly. */
export function getContainer(): Promise<Container> {
  if (!containerPromise) containerPromise = buildContainer();
  return containerPromise;
}
