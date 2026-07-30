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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh_key TEXT NOT NULL,
      auth_key TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL
    );
  `);
  // Slice 14: streak-bonus confirmation records — see
  // src/core/ports/liveStreakBonusRepoPort.ts / domain/types.ts's
  // LiveStreakBonus doc comment for the full "pending -> confirmed/forfeited"
  // lifecycle this table drives.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS live_streak_bonuses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      room_code TEXT NOT NULL,
      points INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      awarded_at TIMESTAMP NOT NULL,
      resolved_at TIMESTAMP
    );
  `);
  // Slice 16 (teacher insights): one row per (finished round, player,
  // question) — see the matching comment in migrateSqlite.ts.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS live_quiz_answer_records (
      id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL,
      set_id TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
      host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      correct BOOLEAN NOT NULL,
      finished_at TIMESTAMP NOT NULL
    );
  `);
  // Slice 17 (async homework mode) — mirrors migrateSqlite.ts. Three new
  // tables, see docs/ADR-homework-mode.md.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS live_homework_assignments (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
      host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      deadline TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS live_homework_attempts (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES live_homework_assignments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS live_homework_answers (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES live_homework_attempts(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      correct BOOLEAN NOT NULL,
      answered_at TIMESTAMP NOT NULL
    );
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sets_owner ON sets(owner_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_review_states_user_due ON review_states(user_id, due_at);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_fsrs_review_states_user_due ON fsrs_review_states(user_id, due_at);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_llm_call_log_user ON llm_call_log(user_id, requested_at);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_live_streak_bonuses_user_card ON live_streak_bonuses(user_id, card_id, status);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_live_streak_bonuses_user_status ON live_streak_bonuses(user_id, status);`);
  // Slice 16: listBySetId's lookup shape, plus the real (non-partial) unique
  // duplicate-write guard — see the matching comment in migrateSqlite.ts.
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_live_quiz_answer_records_set ON live_quiz_answer_records(set_id);`);
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_live_quiz_answer_records_unique ON live_quiz_answer_records(room_code, card_id, user_id);`,
  );

  // Slice 17: same lookups + real unique guards as migrateSqlite.ts.
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_live_homework_assignments_set ON live_homework_assignments(set_id);`);
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_live_homework_assignments_code ON live_homework_assignments(code);`);
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_live_homework_attempts_unique ON live_homework_attempts(assignment_id, user_id);`,
  );
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_live_homework_answers_attempt ON live_homework_answers(attempt_id);`);
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_live_homework_answers_unique ON live_homework_answers(attempt_id, card_id);`,
  );

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

  // Slice 9: due-card reminders' opt-in quiet-hours window. Nullable, no
  // backfill needed — see the matching comment in migrateSqlite.ts.
  await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT;`);
  await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT;`);

  // Slice 10: per-user reading/accessibility profile — see the matching
  // comment in migrateSqlite.ts.
  await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reading_font TEXT NOT NULL DEFAULT 'system';`);
  await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS text_size TEXT NOT NULL DEFAULT 'normal';`);
  await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS line_spacing TEXT NOT NULL DEFAULT 'normal';`);
  await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS contrast TEXT NOT NULL DEFAULT 'normal';`);

  // Slice 15: nullable provenance link — see the matching comment in
  // migrateSqlite.ts / Card.sourceCardId's doc comment.
  await db.execute(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS source_card_id TEXT;`);
  // Review found a real (bounded, non-corrupting) race between concurrent
  // finished-room renders that could both clone the same source card into
  // the same practice set — see the matching comment in migrateSqlite.ts.
  // Postgres partial unique indexes use the same WHERE syntax as SQLite.
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_set_source_unique ON cards(set_id, source_card_id) WHERE source_card_id IS NOT NULL;`,
  );
  // findOrCreatePracticeSet's own read-then-create gap, one level above the
  // card-level race — see the matching comment in migrateSqlite.ts. Marker
  // string must stay in sync with PRACTICE_SET_MARKER in
  // liveQuizPostGameUsecases.ts.
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sets_owner_practice_marker ON sets(owner_id) WHERE description = 'kartka:live-quiz-review-practice-set';`,
  );
}
