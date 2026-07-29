import { eq, isNull } from "drizzle-orm";
import type { SqliteDb } from "./index";
import { sets } from "./schema.sqlite";
import { generateSlug } from "../../core/domain/slug";

export async function migrateSqlite(db: SqliteDb): Promise<void> {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      banned INTEGER NOT NULL DEFAULT 0,
      locale TEXT NOT NULL DEFAULT 'pl',
      created_at INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS review_states (
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      easiness REAL NOT NULL DEFAULT 2.5,
      interval INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      due_at INTEGER NOT NULL,
      last_reviewed_at INTEGER,
      PRIMARY KEY (card_id, user_id)
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS fsrs_review_states (
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      difficulty REAL NOT NULL,
      stability REAL NOT NULL,
      reps INTEGER NOT NULL DEFAULT 0,
      due_at INTEGER NOT NULL,
      last_reviewed_at INTEGER,
      PRIMARY KEY (card_id, user_id)
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS llm_call_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_at INTEGER NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      estimated_cost_usd REAL,
      status TEXT NOT NULL,
      error_message TEXT
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sets_owner ON sets(owner_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_review_states_user_due ON review_states(user_id, due_at);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_fsrs_review_states_user_due ON fsrs_review_states(user_id, due_at);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_llm_call_log_user ON llm_call_log(user_id, requested_at);`);

  // Slice 5: `users` already existed from slice 1 — add the scheduler
  // preference column via ALTER, same pattern as sets.slug in slice 3.
  // Unlike slug this needs no nullable+backfill dance: every existing user
  // can share the same literal default ('sm2', preserving current
  // behavior), so a plain NOT NULL DEFAULT ALTER is enough. SQLite still has
  // no "ADD COLUMN IF NOT EXISTS", hence the catch-and-ignore.
  try {
    db.run(`ALTER TABLE users ADD COLUMN scheduler_preference TEXT NOT NULL DEFAULT 'sm2';`);
  } catch (err) {
    if (!(err instanceof Error) || !/duplicate column name/i.test(err.message)) throw err;
  }

  // Slice 3: `sets` already existed from slice 1, so the slug column is added
  // via ALTER rather than baked into the CREATE TABLE above (keeps one
  // migration path for both fresh and pre-existing databases). SQLite's
  // ALTER TABLE ADD COLUMN forbids UNIQUE/PRIMARY KEY constraints, and has no
  // "IF NOT EXISTS" clause, so: add nullable, catch-and-ignore if it already
  // exists, backfill any NULLs, then enforce uniqueness with a separate index.
  try {
    db.run(`ALTER TABLE sets ADD COLUMN slug TEXT;`);
  } catch (err) {
    if (!(err instanceof Error) || !/duplicate column name/i.test(err.message)) throw err;
  }
  const unslugged = await db.select({ id: sets.id }).from(sets).where(isNull(sets.slug));
  const seen = new Set<string>();
  for (const row of unslugged) {
    let slug = generateSlug();
    while (seen.has(slug)) slug = generateSlug();
    seen.add(slug);
    await db.update(sets).set({ slug }).where(eq(sets.id, row.id));
  }
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sets_slug ON sets(slug);`);

  // Slice 8: cram mode's opt-in exam date. Nullable, no backfill needed —
  // NULL is the correct value for every set that existed before this slice
  // (means "cram mode never activates for this set"), same as
  // scheduler_preference's ALTER above but without a literal default.
  try {
    db.run(`ALTER TABLE sets ADD COLUMN exam_date INTEGER;`);
  } catch (err) {
    if (!(err instanceof Error) || !/duplicate column name/i.test(err.message)) throw err;
  }
}
