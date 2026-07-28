import type { PgDb } from "./index";

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
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sets_owner ON sets(owner_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_review_states_user_due ON review_states(user_id, due_at);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
}
