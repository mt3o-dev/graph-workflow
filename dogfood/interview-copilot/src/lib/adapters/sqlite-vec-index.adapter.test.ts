/**
 * Offline integration tests for the sqlite-vec index adapter [dec:4] against
 * an in-memory database. better-sqlite3 + sqlite-vec build fine on this
 * machine (Node 26, linux-arm64), so nothing here is skipped.
 */
import { describe, expect, it } from 'vitest';
import { describeVectorIndexContract } from '../../test/contracts/vector-index.contract.ts';
import { createSqliteDb } from './sqlite-db.ts';
import { SqliteVecIndexAdapter } from './sqlite-vec-index.adapter.ts';

describeVectorIndexContract('SqliteVecIndexAdapter (in-memory db)', async () => {
	return new SqliteVecIndexAdapter(await createSqliteDb(':memory:'));
});

describe('SqliteVecIndexAdapter persistence semantics', () => {
	it('the binding survives a new adapter instance on the same database', async () => {
		const db = await createSqliteDb(':memory:');
		const first = new SqliteVecIndexAdapter(db);
		await first.open({ model: 'model-a', dimensions: 4 });
		await first.upsert([{ id: 'x', vector: [1, 0.1, 0.1, 0.1] }]);

		const second = new SqliteVecIndexAdapter(db);
		expect(await second.binding()).toEqual({ model: 'model-a', dimensions: 4 });
		await expect(second.open({ model: 'model-b', dimensions: 4 })).rejects.toThrow(
			/bound to model-a/
		);
		await second.open({ model: 'model-a', dimensions: 4 });
		const hits = await second.query([1, 0.1, 0.1, 0.1], 1);
		expect(hits[0]!.id).toBe('x');
	});

	it('query before open fails loudly', async () => {
		const index = new SqliteVecIndexAdapter(await createSqliteDb(':memory:'));
		await expect(index.query([1, 0, 0, 0], 1)).rejects.toThrow(/open\(\) first/);
	});
});
