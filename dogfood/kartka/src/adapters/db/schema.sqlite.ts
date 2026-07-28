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
  visibility: text("visibility", { enum: ["private"] }).notNull().default("private"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  setId: text("set_id").notNull().references(() => sets.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["basic", "cloze", "multiple_choice", "true_false", "type_answer", "image_occlusion"],
  }).notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
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
