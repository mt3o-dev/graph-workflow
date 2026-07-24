/**
 * Migration runner (dec:3) — applies the known migrations in order against a
 * better-sqlite3 database, tracking which ones have already run in a
 * `schema_migrations` table so re-running `migrate()` is a no-op (idempotent).
 *
 * The SQL sources are inlined via Vite `?raw` imports rather than read from a
 * directory at runtime: the bundled server output (adapter-node) does not ship
 * the `migrations/` folder, so a `readdirSync` approach 500s on first boot of
 * a production build (P6 integration finding — same failure class punktomat
 * hit with copied migration dirs). `?raw` keeps one source of truth (the .sql
 * files stay on disk, reviewable) and works identically in dev, vitest, and
 * the bundle. Adding a migration = add the file + one entry to MIGRATIONS.
 */
import type Database from 'better-sqlite3';
import migration001 from './migrations/001_init.sql?raw';
import migration002 from './migrations/002_classification.sql?raw';

/** Ordered, append-only. The id doubles as the schema_migrations key. */
export const MIGRATIONS: readonly { id: string; sql: string }[] = [
	{ id: '001_init.sql', sql: migration001 },
	{ id: '002_classification.sql', sql: migration002 }
];

/**
 * Apply every migration in {@link MIGRATIONS} (in order) that hasn't already
 * been recorded in `schema_migrations`. Each migration is applied inside its
 * own transaction alongside the bookkeeping insert, so a failed migration
 * never gets marked as applied.
 */
export function runMigrations(
	db: Database.Database,
	migrations: readonly { id: string; sql: string }[] = MIGRATIONS
): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL
		)
	`);

	const isApplied = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?');
	const markApplied = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)');

	for (const { id, sql } of migrations) {
		if (isApplied.get(id)) {
			continue;
		}
		const applyOne = db.transaction(() => {
			db.exec(sql);
			markApplied.run(id, new Date().toISOString());
		});
		applyOne();
	}
}
