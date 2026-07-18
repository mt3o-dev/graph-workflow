import type { Database } from 'better-sqlite3';

/**
 * Opens the app's single SQLite database [dec:4][dec:12] with the sqlite-vec
 * extension loaded. One file holds both the vector index and the session log
 * (separate tables). Dynamic imports keep the native module out of any
 * browser bundle graph; call this only from Node contexts (sidecar, tests).
 */
export async function createSqliteDb(file: string): Promise<Database> {
	const { default: BetterSqlite3 } = await import('better-sqlite3');
	const sqliteVec = await import('sqlite-vec');
	const db = new BetterSqlite3(file);
	sqliteVec.load(db);
	return db;
}
