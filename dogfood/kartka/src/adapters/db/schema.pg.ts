import { pgTable, text, integer, real, boolean, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";

// NOTE: this file mirrors schema.sqlite.ts field-for-field. Drizzle's sqlite and
// pg column builders are different APIs, so a single shared schema isn't
// practical (see docs/architecture.md) — keep both in sync by hand.

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["student", "admin"] }).notNull().default("student"),
  banned: boolean("banned").notNull().default(false),
  locale: text("locale", { enum: ["pl", "en"] }).notNull().default("pl"),
  // Slice 5: per-user scheduler choice (SM-2 vs FSRS). Added via ALTER in
  // migratePg.ts.
  schedulerPreference: text("scheduler_preference", { enum: ["sm2", "fsrs"] }).notNull().default("sm2"),
  // Slice 9: opt-in quiet-hours window for due-card reminders, "HH:MM" 24h
  // strings, both null by default. Added via ALTER in migratePg.ts.
  quietHoursStart: text("quiet_hours_start"),
  quietHoursEnd: text("quiet_hours_end"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
});

export const sets = pgTable("sets", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  visibility: text("visibility", { enum: ["private", "unlisted", "public"] }).notNull().default("private"),
  // Slice 3: share-by-slug. Not marked .unique() here to mirror
  // schema.sqlite.ts field-for-field (see the note there); uniqueness is
  // enforced by a separate `CREATE UNIQUE INDEX` in migratePg.ts.
  slug: text("slug").notNull(),
  // Slice 8: cram mode's opt-in exam date. Nullable — most sets have none.
  // Added via ALTER in migratePg.ts, same pattern as scheduler_preference.
  examDate: timestamp("exam_date", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  setId: text("set_id").notNull().references(() => sets.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["basic", "cloze", "multiple_choice", "true_false", "type_answer", "image_occlusion"],
  }).notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const reviewStates = pgTable(
  "review_states",
  {
    cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    easiness: real("easiness").notNull().default(2.5),
    interval: integer("interval").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    dueAt: timestamp("due_at", { mode: "date" }).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { mode: "date" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.userId] })],
);

// Slice 5: per-(card,user) FSRS scheduling state, alongside review_states
// (SM-2's table, unchanged). Deliberately a separate table rather than
// widening review_states — {difficulty,stability} aren't the same thing as
// {easiness,interval,repetitions}, see FsrsReviewState / SchedulerPort.
export const fsrsReviewStates = pgTable(
  "fsrs_review_states",
  {
    cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    difficulty: real("difficulty").notNull(),
    stability: real("stability").notNull(),
    reps: integer("reps").notNull().default(0),
    dueAt: timestamp("due_at", { mode: "date" }).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { mode: "date" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.userId] })],
);

// Slice 2: cost/usage log for every OpenRouter call (success or failure).
// Read by slice 4's admin analytics — see docs/architecture.md.
export const llmCallLog = pgTable("llm_call_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestedAt: timestamp("requested_at", { mode: "date" }).notNull(),
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
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});
