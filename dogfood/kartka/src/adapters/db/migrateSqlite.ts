import { eq, isNull } from "drizzle-orm";
import type { SqliteDb } from "./index";
import { sets } from "./schema.sqlite";
import { generateSlug } from "../../core/domain/slug";

// Drizzle's `db.run()` wraps the underlying bun:sqlite driver error in its
// own DrizzleQueryError, whose OWN `.message` is a generic "Failed to run
// the query '...'" string — the real "duplicate column name: x" text from
// SQLite lives on `err.cause.message`, one level down. Checking only
// `err.message` (as every ALTER-TABLE guard below originally did) never
// matches, so the "already exists, ignore" branch is silently dead and the
// real duplicate-column error rethrows on every second call to this
// function against an already-migrated database — invisible in `bun test`
// (fresh per-file DBs, migrate() runs exactly once per process) but fatal
// the moment a second process (e.g. slice 11's live-quiz WebSocket sidecar)
// opens the same already-migrated file. Check both levels.
function isDuplicateColumnError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const pattern = /duplicate column name/i;
  if (pattern.test(err.message)) return true;
  const cause = (err as { cause?: unknown }).cause;
  return cause instanceof Error && pattern.test(cause.message);
}

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
  db.run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh_key TEXT NOT NULL,
      auth_key TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  // Slice 14: streak-bonus confirmation records — see
  // src/core/ports/liveStreakBonusRepoPort.ts / domain/types.ts's
  // LiveStreakBonus doc comment for the full "pending -> confirmed/forfeited"
  // lifecycle this table drives.
  db.run(`
    CREATE TABLE IF NOT EXISTS live_streak_bonuses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      room_code TEXT NOT NULL,
      points INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      awarded_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
  `);
  // Slice 16 (teacher insights): one row per (finished round, player,
  // question) — see LiveQuizInsightsRepoPort / LiveQuizAnswerRecord's doc
  // comment in domain/types.ts. A brand-new table (like live_streak_bonuses
  // above), so no ALTER-table dance is needed.
  db.run(`
    CREATE TABLE IF NOT EXISTS live_quiz_answer_records (
      id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL,
      set_id TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
      host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      correct INTEGER NOT NULL,
      finished_at INTEGER NOT NULL
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sets_owner ON sets(owner_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_review_states_user_due ON review_states(user_id, due_at);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_fsrs_review_states_user_due ON fsrs_review_states(user_id, due_at);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_llm_call_log_user ON llm_call_log(user_id, requested_at);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);`);
  // Not a UNIQUE index (would forbid a legitimate re-subscribe upsert race
  // producing a duplicate endpoint momentarily); ownership + lookup are
  // scoped by (user_id, endpoint) together in pushSubscriptionRepo, and a
  // stray duplicate row is harmless (both get cleaned up on the same 410).
  db.run(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);`);
  // Slice 14: findUnresolvedByUserAndCard's lookup shape — not unique (the
  // repo/usecase layer, not the DB, enforces "at most one unresolved per
  // pair", same division of responsibility as push_subscriptions above).
  db.run(`CREATE INDEX IF NOT EXISTS idx_live_streak_bonuses_user_card ON live_streak_bonuses(user_id, card_id, status);`);
  // Slice 14: sumConfirmedPointsForUser's lookup shape.
  db.run(`CREATE INDEX IF NOT EXISTS idx_live_streak_bonuses_user_status ON live_streak_bonuses(user_id, status);`);
  // Slice 16: listBySetId's lookup shape.
  db.run(`CREATE INDEX IF NOT EXISTS idx_live_quiz_answer_records_set ON live_quiz_answer_records(set_id);`);
  // The duplicate-write guard (roadmap point 1): at most one recorded
  // outcome per (room, question, player) — a REAL unique index, not a
  // partial one (unlike slice 15's practice-set-marker index), since every
  // row in this table is meant to be constrained this way, not just a
  // subset. Concurrent finished-round renders that both try to record the
  // same round's results race here at the DB level; the repo
  // (liveQuizInsightsRepo.*.ts) uses onConflictDoNothing() so the loser of
  // the race is silently skipped instead of throwing — the exact
  // "DB-level constraint + graceful handling" class of fix slice 15's
  // review landed on, applied here from the start.
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_live_quiz_answer_records_unique ON live_quiz_answer_records(room_code, card_id, user_id);`,
  );

  // Slice 5: `users` already existed from slice 1 — add the scheduler
  // preference column via ALTER, same pattern as sets.slug in slice 3.
  // Unlike slug this needs no nullable+backfill dance: every existing user
  // can share the same literal default ('sm2', preserving current
  // behavior), so a plain NOT NULL DEFAULT ALTER is enough. SQLite still has
  // no "ADD COLUMN IF NOT EXISTS", hence the catch-and-ignore.
  try {
    db.run(`ALTER TABLE users ADD COLUMN scheduler_preference TEXT NOT NULL DEFAULT 'sm2';`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
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
    if (!isDuplicateColumnError(err)) throw err;
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
    if (!isDuplicateColumnError(err)) throw err;
  }

  // Slice 9: due-card reminders' opt-in quiet-hours window. Nullable, no
  // backfill needed — NULL means "no quiet hours" for every user that
  // existed before this slice, same pattern as sets.exam_date above.
  try {
    db.run(`ALTER TABLE users ADD COLUMN quiet_hours_start TEXT;`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
  try {
    db.run(`ALTER TABLE users ADD COLUMN quiet_hours_end TEXT;`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }

  // Slice 10: per-user reading/accessibility profile. Every existing user
  // can share the same literal defaults (preserving current behavior), same
  // no-backfill-needed pattern as scheduler_preference above.
  for (const [col, def] of [
    ["reading_font", "system"],
    ["text_size", "normal"],
    ["line_spacing", "normal"],
    ["contrast", "normal"],
  ] as const) {
    try {
      db.run(`ALTER TABLE users ADD COLUMN ${col} TEXT NOT NULL DEFAULT '${def}';`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) throw err;
    }
  }

  // Slice 15 (live-quiz post-game review import): nullable provenance link
  // from a cloned review-queue card back to its source card. Nullable, no
  // backfill needed — NULL is the correct value for every card that existed
  // before this slice (means "not a post-game import clone"), same pattern
  // as sets.exam_date/users.quiet_hours_* above. Reuses THIS FILE's shared
  // isDuplicateColumnError guard (see its header comment for why a fresh
  // ad-hoc `err.message` regex would silently be dead code the moment a
  // second process — e.g. live-server.ts — opens an already-migrated DB).
  try {
    db.run(`ALTER TABLE cards ADD COLUMN source_card_id TEXT;`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
  // Review found a real (bounded, non-corrupting) race: two concurrent
  // finished-room renders (e.g. a broadcast in flight plus a reconnecting
  // socket) can both read "not yet imported" for the same (set, source
  // card) pair before either writes, producing two clone cards instead of
  // one. A DB-level constraint closes this properly instead of an
  // in-process lock, which wouldn't help across the sidecar's concurrent
  // WS handlers. Partial index (SQLite supports WHERE on CREATE INDEX)
  // since most cards have a NULL source_card_id and NULLs never collide in
  // a unique index anyway — this only constrains actual clone rows.
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_set_source_unique ON cards(set_id, source_card_id) WHERE source_card_id IS NOT NULL;`,
  );

  // The card-level race above wasn't the whole story: findOrCreatePracticeSet
  // (liveQuizPostGameUsecases.ts) has the identical read-then-create gap one
  // level up — two concurrent import calls for a player's FIRST live round
  // ever can each see "no practice set yet" and each create their own,
  // producing two separate practice sets (each then getting its own clone
  // cards, so the cards-level unique index above never even triggers, since
  // set_id differs between them). A literal-value partial unique index
  // enforces "at most one set per owner with this exact marker description"
  // without constraining ordinary sets, whose descriptions are frequently
  // identical/blank across a user's normal sets (a blanket unique index on
  // (owner_id, description) would wrongly break that). The marker string
  // must stay in sync with PRACTICE_SET_MARKER in
  // liveQuizPostGameUsecases.ts — duplicated here deliberately since a
  // migration can't import application code.
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sets_owner_practice_marker ON sets(owner_id) WHERE description = 'kartka:live-quiz-review-practice-set';`,
  );
}
