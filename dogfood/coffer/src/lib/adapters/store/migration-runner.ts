/**
 * Migration runner (dec:3) — applies `migrations/NNN_*.sql` files in
 * lexicographic order against a better-sqlite3 database, tracking which ones
 * have already run in a `schema_migrations` table so re-running `migrate()`
 * is a no-op (idempotent).
 *
 * This is an adapter module (outside src/lib/core), so node builtins are
 * fine here — same pattern as layered-config.adapter.ts and
 * boundary-lint.test.ts's own directory-relative path derivation.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';

export const DEFAULT_MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Apply every `.sql` file under `migrationsDir` (lexicographic order) that
 * hasn't already been recorded in `schema_migrations`. Each migration file is
 * applied inside its own transaction alongside the bookkeeping insert, so a
 * failed migration never gets marked as applied.
 */
export function runMigrations(db: Database.Database, migrationsDir: string = DEFAULT_MIGRATIONS_DIR): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL
		)
	`);

	const files = readdirSync(migrationsDir)
		.filter((name) => name.endsWith('.sql'))
		.sort();

	const isApplied = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?');
	const markApplied = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)');

	for (const file of files) {
		if (isApplied.get(file)) {
			continue;
		}
		const sql = readFileSync(join(migrationsDir, file), 'utf-8');
		const applyOne = db.transaction(() => {
			db.exec(sql);
			markApplied.run(file, new Date().toISOString());
		});
		applyOne();
	}
}
