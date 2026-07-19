/**
 * InMemoryStoreAdapter — a pure-JS StorePort fake (Phase 4, dec:3 mitigation).
 *
 * Deliberately NOT better-sqlite3 `:memory:` — that still requires the native
 * build to succeed. This is a plain `Map` keyed by `contentHash`, so the
 * StorePort contract (and anything built on it, e.g. the Phase 7 pipeline)
 * stays verifiable even if the native build fails on this machine.
 */
import type { Transaction } from '../../lib/core/model/transaction.js';
import type { ImportBatch, SaveResult, StorePort } from '../../lib/ports/store.port.js';

export class InMemoryStoreAdapter implements StorePort {
	private readonly batches = new Map<string, ImportBatch>();
	private readonly transactionsByHash = new Map<string, Transaction>();

	async migrate(): Promise<void> {
		// No schema to apply — the Map IS the schema.
	}

	async createBatch(
		batch: Omit<ImportBatch, 'id' | 'importedAt'> & { id: string; importedAt: string }
	): Promise<ImportBatch> {
		const created: ImportBatch = {
			id: batch.id,
			importedAt: batch.importedAt,
			parserId: batch.parserId,
			sourceLabel: batch.sourceLabel
		};
		this.batches.set(created.id, created);
		return created;
	}

	async save(batchId: string, txns: readonly Transaction[]): Promise<SaveResult> {
		let inserted = 0;
		let duplicates = 0;
		for (const t of txns) {
			if (this.transactionsByHash.has(t.contentHash)) {
				duplicates++;
			} else {
				this.transactionsByHash.set(t.contentHash, t);
				inserted++;
			}
		}
		return { batchId, inserted, duplicates };
	}

	async all(): Promise<Transaction[]> {
		return Array.from(this.transactionsByHash.values());
	}

	async count(): Promise<number> {
		return this.transactionsByHash.size;
	}

	async has(contentHash: string): Promise<boolean> {
		return this.transactionsByHash.has(contentHash);
	}

	async close(): Promise<void> {
		// Nothing to release.
	}
}
