import "../../env"; // ensure env is validated before we read process.env below
import { ENV } from "varlock/env";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type DbDriver = "sqlite" | "postgres";

async function buildSqliteDb() {
  const { Database } = await import("bun:sqlite");
  const { drizzle } = await import("drizzle-orm/bun-sqlite");
  const schema = await import("./schema.sqlite");

  const path = ENV.DB_SQLITE_PATH || "./data/kartka.db";
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  return drizzle(sqlite, { schema });
}

async function buildPgDb() {
  const { drizzle } = await import("drizzle-orm/bun-sql");
  const schema = await import("./schema.pg");

  if (!ENV.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when DB_DRIVER=postgres");
  }
  return drizzle(ENV.DATABASE_URL, { schema });
}

// The exported `db` type is a structural union of both drivers' query builder
// surfaces. Repos only use the subset (select/insert/update/delete) that both
// support identically, so this stays type-safe without a common abstract class.
export type SqliteDb = Awaited<ReturnType<typeof buildSqliteDb>>;
export type PgDb = Awaited<ReturnType<typeof buildPgDb>>;
export type AnyDb = SqliteDb | PgDb;

let _dbPromise: Promise<AnyDb> | undefined;

export function getDriver(): DbDriver {
  return (ENV.DB_DRIVER || "sqlite") as DbDriver;
}

export function getDb(): Promise<AnyDb> {
  if (!_dbPromise) {
    _dbPromise = getDriver() === "postgres" ? buildPgDb() : buildSqliteDb();
  }
  return _dbPromise;
}

/**
 * Creates the schema for the active driver. Slice 1 doesn't ship a full
 * drizzle-kit migration pipeline (see docs/RUNNING.md) — this runs idempotent
 * `CREATE TABLE IF NOT EXISTS` DDL directly, which is sufficient for a
 * greenfield slice with no prior schema to migrate from.
 */
export async function migrate(): Promise<void> {
  const driver = getDriver();
  const db = await getDb();
  if (driver === "sqlite") {
    const { migrateSqlite } = await import("./migrateSqlite");
    await migrateSqlite(db as SqliteDb);
  } else {
    const { migratePg } = await import("./migratePg");
    await migratePg(db as PgDb);
  }
}
