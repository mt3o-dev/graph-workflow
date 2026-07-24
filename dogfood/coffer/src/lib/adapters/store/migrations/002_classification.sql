-- 002_classification.sql — coffer-classification slice 2 (dec:6, dec:91d27d36,
-- dec:eb01608c, dec:efd6891c). Applied by the same migration-runner.ts as
-- 001_init.sql (lexicographic order, idempotent, tracked in
-- schema_migrations). Requires PRAGMA foreign_keys = ON on the connection
-- for the declared FKs below to be enforced (see R2 — retrofitted into
-- SqliteStoreAdapter and set on every SqliteClassificationStoreAdapter
-- connection).

CREATE TABLE IF NOT EXISTS groups (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	parent_id TEXT REFERENCES groups (id) ON DELETE SET NULL,
	kind TEXT NOT NULL CHECK (kind IN ('group', 'tag'))
);

CREATE INDEX IF NOT EXISTS idx_groups_parent_id ON groups (parent_id);

-- Rule predicate/assign are persisted as JSON text (dec:eb01608c — predicate
-- is serializable DATA, not a JS function). "order" is quoted throughout
-- (reserved word) and drives ordered evaluation in the pure core engine.
CREATE TABLE IF NOT EXISTS rules (
	id TEXT PRIMARY KEY,
	name TEXT,
	"order" INTEGER NOT NULL,
	predicate TEXT NOT NULL,
	assign TEXT NOT NULL,
	stop_after INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rules_order ON rules ("order");

-- Assignments key a transaction by its content_hash (the domain Transaction
-- has no surrogate id, dec:235e0742) — FK to transactions(content_hash),
-- which requires 001_init.sql's UNIQUE constraint on that column and FK
-- enforcement actually being on (R2). UNIQUE(tx_content_hash, group_id)
-- makes re-running the rule engine idempotent (dec:efd6891c) — no duplicate
-- assignment rows on re-eval.
CREATE TABLE IF NOT EXISTS assignments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tx_content_hash TEXT NOT NULL REFERENCES transactions (content_hash),
	group_id TEXT NOT NULL REFERENCES groups (id),
	source TEXT NOT NULL CHECK (source IN ('rule', 'manual', 'assist')),
	rule_id TEXT REFERENCES rules (id),
	created_at TEXT NOT NULL,
	UNIQUE (tx_content_hash, group_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_tx_content_hash ON assignments (tx_content_hash);
CREATE INDEX IF NOT EXISTS idx_assignments_group_id ON assignments (group_id);
