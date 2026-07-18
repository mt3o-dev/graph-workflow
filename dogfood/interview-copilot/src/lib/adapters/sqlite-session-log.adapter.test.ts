/**
 * Offline integration tests for the better-sqlite3 session log [dec:12]
 * against an in-memory database (same DB file as the index in production,
 * separate tables).
 */
import { describe, expect, it } from 'vitest';
import { describeSessionLogContract } from '../../test/contracts/session-log.contract.ts';
import { createSqliteDb } from './sqlite-db.ts';
import { SqliteSessionLogAdapter } from './sqlite-session-log.adapter.ts';
import { SqliteVecIndexAdapter } from './sqlite-vec-index.adapter.ts';

describeSessionLogContract('SqliteSessionLogAdapter (in-memory db)', async () => {
	return new SqliteSessionLogAdapter(await createSqliteDb(':memory:'));
});

describe('SqliteSessionLogAdapter shares one database with the vector index [dec:4]', () => {
	it('both adapters coexist on the same connection with separate tables', async () => {
		const db = await createSqliteDb(':memory:');
		const log = new SqliteSessionLogAdapter(db);
		const index = new SqliteVecIndexAdapter(db);
		await index.open({ model: 'm', dimensions: 4 });
		await index.upsert([{ id: 'doc', vector: [1, 0.1, 0.1, 0.1] }]);
		const sessionId = await log.startSession(5);
		await log.logUtterance(sessionId, { id: 'u1', text: 'hi', startMs: 0, endMs: 10 }, 'statement');
		expect((await index.query([1, 0.1, 0.1, 0.1], 1))[0]!.id).toBe('doc');
		expect((await log.getSession(sessionId))!.utterances).toHaveLength(1);
	});
});
