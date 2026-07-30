import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

// NOTE: this file mirrors schema.pg.ts field-for-field. Drizzle's sqlite and
// pg column builders are different APIs, so a single shared schema isn't
// practical (see docs/architecture.md) — keep both in sync by hand.

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["student", "admin"] }).notNull().default("student"),
  banned: integer("banned", { mode: "boolean" }).notNull().default(false),
  locale: text("locale", { enum: ["pl", "en"] }).notNull().default("pl"),
  // Slice 5: per-user scheduler choice (SM-2 vs FSRS). Added via ALTER in
  // migrateSqlite.ts — see the comment there for why a shared literal
  // default doesn't need the slug column's nullable+backfill dance.
  schedulerPreference: text("scheduler_preference", { enum: ["sm2", "fsrs"] }).notNull().default("sm2"),
  // Slice 9: opt-in quiet-hours window for due-card reminders, "HH:MM" 24h
  // strings, both null by default (no quiet hours). Added via ALTER in
  // migrateSqlite.ts, same no-backfill-needed pattern as exam_date.
  quietHoursStart: text("quiet_hours_start"),
  quietHoursEnd: text("quiet_hours_end"),
  // Slice 10: per-user reading/accessibility profile, one column per
  // independent preference (same pattern as scheduler_preference above, not
  // a combined JSON blob). Added via ALTER in migrateSqlite.ts.
  readingFont: text("reading_font", { enum: ["system", "opendyslexic"] }).notNull().default("system"),
  textSize: text("text_size", { enum: ["normal", "large", "xlarge"] }).notNull().default("normal"),
  lineSpacing: text("line_spacing", { enum: ["normal", "relaxed", "loose"] }).notNull().default("normal"),
  contrast: text("contrast", { enum: ["normal", "high"] }).notNull().default("normal"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // opaque session token
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const sets = sqliteTable("sets", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  visibility: text("visibility", { enum: ["private", "unlisted", "public"] }).notNull().default("private"),
  // Slice 3: share-by-slug. Not marked .unique() here — SQLite's ALTER TABLE
  // ADD COLUMN forbids UNIQUE-constrained columns, so uniqueness is enforced
  // by a separate `CREATE UNIQUE INDEX` in migrateSqlite.ts/migratePg.ts
  // instead (see the comment there for why).
  slug: text("slug").notNull(),
  // Slice 8: cram mode's opt-in exam date. Nullable — most sets have none.
  // Added via ALTER in migrateSqlite.ts, same pattern as scheduler_preference
  // (no backfill needed: NULL is the correct default for every existing set).
  examDate: integer("exam_date", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  setId: text("set_id").notNull().references(() => sets.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["basic", "cloze", "multiple_choice", "true_false", "type_answer", "image_occlusion"],
  }).notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  // Slice 15 (live-quiz post-game review import): nullable provenance link
  // to the card this one was cloned from — see Card.sourceCardId's doc
  // comment. Added via ALTER in migrateSqlite.ts (same nullable/no-backfill
  // pattern as sets.exam_date) since `cards` already existed from slice 1.
  // No FK constraint (mirrors sets.slug/exam_date's own lack of one) — a
  // self-referencing FK on a column added via ALTER is unnecessary
  // complexity for what's purely an informational/dedupe link.
  sourceCardId: text("source_card_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const reviewStates = sqliteTable(
  "review_states",
  {
    cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    easiness: real("easiness").notNull().default(2.5),
    interval: integer("interval").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.userId] })],
);

// Slice 5: per-(card,user) FSRS scheduling state, alongside review_states
// (SM-2's table, unchanged). Deliberately a separate table rather than
// widening review_states — {difficulty,stability} aren't the same thing as
// {easiness,interval,repetitions}, see FsrsReviewState / SchedulerPort.
export const fsrsReviewStates = sqliteTable(
  "fsrs_review_states",
  {
    cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    difficulty: real("difficulty").notNull(),
    stability: real("stability").notNull(),
    reps: integer("reps").notNull().default(0),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.userId] })],
);

// Slice 2: cost/usage log for every OpenRouter call (success or failure).
// Read by slice 4's admin analytics — see docs/architecture.md.
export const llmCallLog = sqliteTable("llm_call_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  estimatedCostUsd: real("estimated_cost_usd"),
  status: text("status", { enum: ["success", "error"] }).notNull(),
  errorMessage: text("error_message"),
});

// Slice 9: one row per browser/device Web Push subscription. A user can have
// several (multiple devices) — see PushSubscriptionRepoPort.
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// Slice 14: one row per streak-bonus "did it actually stick" record — see
// LiveStreakBonusRepoPort / LiveStreakBonus's doc comment in domain/types.ts.
export const liveStreakBonuses = sqliteTable("live_streak_bonuses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  roomCode: text("room_code").notNull(),
  points: integer("points").notNull(),
  status: text("status", { enum: ["pending", "confirmed", "forfeited"] }).notNull().default("pending"),
  awardedAt: integer("awarded_at", { mode: "timestamp_ms" }).notNull(),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
});

// Slice 16 (teacher insights): one row per (finished round, player, question)
// — see LiveQuizInsightsRepoPort / LiveQuizAnswerRecord's doc comment in
// domain/types.ts. Written once per finished round, independently of (and
// additively alongside) slice 15's post-game review import.
export const liveQuizAnswerRecords = sqliteTable("live_quiz_answer_records", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull(),
  setId: text("set_id").notNull().references(() => sets.id, { onDelete: "cascade" }),
  hostId: text("host_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }).notNull(),
});

// Slice 17 (async homework mode): a durable, deadline-bound async variant of
// the live-quiz concept — deliberately NOT built on the in-memory
// RoomState/LiveSessionPort/WebSocket machinery (see docs/ADR-homework-mode.md).
// One assignment = one set published under a short shareable code with a
// future deadline. `code` is not marked .unique() here (mirrors sets.slug's
// note) — uniqueness is a separate CREATE UNIQUE INDEX in migrate*.ts.
export const liveHomeworkAssignments = sqliteTable("live_homework_assignments", {
  id: text("id").primaryKey(),
  setId: text("set_id").notNull().references(() => sets.id, { onDelete: "cascade" }),
  hostId: text("host_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  deadline: integer("deadline", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// Slice 17: one student's single attempt at one assignment. `score` is a
// snapshot correct-count set at completion; the leaderboard recomputes from
// answer records (source of truth). At most one row per (assignment_id,
// user_id) — a real unique index in migrate*.ts is the one-attempt-per-student
// guard.
export const liveHomeworkAttempts = sqliteTable("live_homework_attempts", {
  id: text("id").primaryKey(),
  assignmentId: text("assignment_id").notNull().references(() => liveHomeworkAssignments.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  score: integer("score").notNull().default(0),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// Slice 17: one recorded answer per (attempt, question). At most one row per
// (attempt_id, card_id) — a real unique index in migrate*.ts is the
// double-submit / double-tab guard (recordAnswer uses onConflictDoNothing),
// the same DB-constraint discipline slices 15/16 landed on.
export const liveHomeworkAnswers = sqliteTable("live_homework_answers", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id").notNull().references(() => liveHomeworkAttempts.id, { onDelete: "cascade" }),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  answeredAt: integer("answered_at", { mode: "timestamp_ms" }).notNull(),
});
