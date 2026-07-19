-- 001_init.sql — Phase 4 (dec:3): base schema for import-batch tracking and
-- deduplicated transaction storage. Applied by migration-runner.ts, tracked
-- in schema_migrations (created by the runner itself, not this file).
--
-- amount_minor is stored as TEXT (not INTEGER) so arbitrary-precision bigint
-- amounts round-trip exactly through SQLite's storage classes without going
-- through a lossy 53-bit-safe REAL/INTEGER path.

CREATE TABLE IF NOT EXISTS import_batches (
	id TEXT PRIMARY KEY,
	imported_at TEXT NOT NULL,
	parser_id TEXT NOT NULL,
	source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	booking_date TEXT NOT NULL,
	value_date TEXT NOT NULL,
	amount_minor TEXT NOT NULL,
	currency TEXT NOT NULL,
	direction TEXT NOT NULL,
	counterparty TEXT NOT NULL,
	description TEXT NOT NULL,
	source_account TEXT NOT NULL,
	import_batch_id TEXT NOT NULL REFERENCES import_batches (id),
	content_hash TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_transactions_import_batch_id ON transactions (import_batch_id);
