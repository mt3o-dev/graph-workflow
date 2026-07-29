import { eq, isNull } from "drizzle-orm";
import type { PgDb } from "./index";
import { sets } from "./schema.pg";
import { generateSlug } from "../../core/domain/slug";

export async function migratePg(db: PgDb): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      banned BOOLEAN NOT NULL DEFAULT FALSE,
      locale TEXT NOT NULL DEFAULT 'pl',
      created_at TIMESTAMP NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL,
      expires_at TIMESTAMP NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at TIMESTAMP NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS review_states (
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      easiness REAL NOT NULL DEFAULT 2.5,
      interval INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      due_at TIMESTAMP NOT NULL,
      last_reviewed_at TIMESTAMP,
      PRIMARY KEY (card_id, user_id)
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS fsrs_review_states (
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      difficulty REAL NOT NULL,
      stability REAL NOT NULL,
      reps INTEGER NOT NULL DEFAULT 0,
      due_at TIMESTAMP NOT NULL,
      last_reviewed_at TIMESTAMP,
      PRIMARY KEY (card_id, user_id)
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS llm_call_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_at TIMESTAMP NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      estimated_cost_usd REAL,
      status TEXT NOT NULL,
      error_message TEXT
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sets_owner ON sets(owner_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_review_states_user_due ON review_states(user_id, due_at);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_fsrs_review_states_user_due ON fsrs_review_states(user_id, due_at);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_llm_call_log_user ON llm_call_log(user_id, requested_at);`);

  // Slice 5: `users` already existed from slice 1 — add the scheduler
  // preference column via ALTER, same pattern as sets.slug in slice 3. No
  // backfill needed (unlike slug): every existing user can share the same
  // literal default ('sm2', preserving current behavior).
  await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS scheduler_preference TEXT NOT NULL DEFAULT 'sm2';`);

  // Slice 3: `sets` already existed from slice 1 — see the matching comment
  // in migrateSqlite.ts for why this is an ALTER + backfill + separate
  // unique index rather than a column constraint. Postgres supports
  // "ADD COLUMN IF NOT EXISTS" natively, unlike SQLite.
  await db.execute(`ALTER TABLE sets ADD COLUMN IF NOT EXISTS slug TEXT;`);
  const unslugged = await db.select({ id: sets.id }).from(sets).where(isNull(sets.slug));
  const seen = new Set<string>();
  for (const row of unslugged) {
    let slug = generateSlug();
    while (seen.has(slug)) slug = generateSlug();
    seen.add(slug);
    await db.update(sets).set({ slug }).where(eq(sets.id, row.id));
  }
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sets_slug ON sets(slug);`);

  // Slice 8: cram mode's opt-in exam date. Nullable, no backfill needed — see
  // the matching comment in migrateSqlite.ts.
  await db.execute(`ALTER TABLE sets ADD COLUMN IF NOT EXISTS exam_date TIMESTAMP;`);
}
