import type { Database } from 'better-sqlite3';
import type { IndexBinding } from '../ports/types.ts';
import { IndexBindingMismatchError, type VectorIndexPort } from '../ports/vector-index.port.ts';

/**
 * VectorIndexPort backed by sqlite-vec [dec:4]. Cosine distance, single
 * `vec0` virtual table. The index records `(model, dimensions)` in
 * `index_meta` and refuses to open with a different binding [dec:3
 * constraint] — switching embedding adapters requires reindexing.
 */
export class SqliteVecIndexAdapter implements VectorIndexPort {
	private opened = false;

	constructor(private readonly db: Database) {
		this.db.exec(
			'CREATE TABLE IF NOT EXISTS index_meta (id INTEGER PRIMARY KEY CHECK (id = 1), model TEXT NOT NULL, dimensions INTEGER NOT NULL)'
		);
	}

	async open(binding: IndexBinding): Promise<void> {
		const stored = await this.binding();
		if (stored === null) {
			this.db
				.prepare('INSERT INTO index_meta (id, model, dimensions) VALUES (1, ?, ?)')
				.run(binding.model, binding.dimensions);
		} else if (stored.model !== binding.model || stored.dimensions !== binding.dimensions) {
			throw new IndexBindingMismatchError(stored, binding);
		}
		if (!this.opened) {
			this.db.exec(
				`CREATE VIRTUAL TABLE IF NOT EXISTS kb_vectors USING vec0(
					id TEXT PRIMARY KEY,
					embedding FLOAT[${binding.dimensions}] distance_metric=cosine
				)`
			);
			this.opened = true;
		}
	}

	async binding(): Promise<IndexBinding | null> {
		const row = this.db
			.prepare('SELECT model, dimensions FROM index_meta WHERE id = 1')
			.get() as { model: string; dimensions: number } | undefined;
		return row ? { model: row.model, dimensions: row.dimensions } : null;
	}

	async upsert(entries: ReadonlyArray<{ id: string; vector: readonly number[] }>): Promise<void> {
		this.assertOpen();
		const del = this.db.prepare('DELETE FROM kb_vectors WHERE id = ?');
		const ins = this.db.prepare('INSERT INTO kb_vectors (id, embedding) VALUES (?, ?)');
		const tx = this.db.transaction(
			(rows: ReadonlyArray<{ id: string; vector: readonly number[] }>) => {
				for (const { id, vector } of rows) {
					del.run(id);
					ins.run(id, JSON.stringify(vector));
				}
			}
		);
		tx(entries);
	}

	async query(
		vector: readonly number[],
		topK: number
	): Promise<Array<{ id: string; score: number }>> {
		this.assertOpen();
		const rows = this.db
			.prepare(
				'SELECT id, distance FROM kb_vectors WHERE embedding MATCH ? AND k = ? ORDER BY distance'
			)
			.all(JSON.stringify(vector), topK) as Array<{ id: string; distance: number }>;
		// sqlite-vec cosine distance = 1 - cosine similarity.
		return rows.map((row) => ({ id: row.id, score: 1 - row.distance }));
	}

	private assertOpen(): void {
		if (!this.opened) throw new Error('SqliteVecIndexAdapter: call open() first');
	}
}
