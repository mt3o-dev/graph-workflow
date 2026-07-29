// Regression test for a real bug slice 11's review caught: migrateSqlite's
// "duplicate column, ignore" guards checked only `err.message`, but
// Drizzle's `db.run()` wraps the underlying bun:sqlite error in its own
// DrizzleQueryError — the actual "duplicate column name: x" text lives on
// `err.cause.message`, one level down. The guards were silently dead, which
// bun test itself never caught because every test file gets a fresh,
// never-before-migrated sqlite file and migrate() only runs once per
// process. The bug only surfaces when a SECOND process opens an
// ALREADY-migrated database file and calls migrate() again — exactly what
// slice 11's live-quiz WebSocket sidecar (a second Bun.serve() process
// sharing the same DB_SQLITE_PATH) does on every boot.
import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { unlinkSync } from "node:fs";
import * as schema from "../src/adapters/db/schema.sqlite";
import { migrateSqlite } from "../src/adapters/db/migrateSqlite";

describe("migrateSqlite — idempotent across separate process/connection boundaries", () => {
  test("running migrate() twice against the same already-migrated file does not throw", async () => {
    const dbPath = `./data/test-migrate-twice-${crypto.randomUUID()}.db`;

    try {
      const first = new Database(dbPath, { create: true });
      await migrateSqlite(drizzle(first, { schema }) as never);
      first.close();

      // A brand-new Database/drizzle instance against the SAME file — this
      // is exactly what live-server.ts's separate process does against the
      // main app's already-migrated DB_SQLITE_PATH.
      const second = new Database(dbPath);
      await expect(migrateSqlite(drizzle(second, { schema }) as never)).resolves.toBeUndefined();
      second.close();
    } finally {
      try {
        unlinkSync(dbPath);
        unlinkSync(`${dbPath}-shm`);
        unlinkSync(`${dbPath}-wal`);
      } catch {
        // best-effort cleanup, fine if wal/shm files don't exist
      }
    }
  });
});
