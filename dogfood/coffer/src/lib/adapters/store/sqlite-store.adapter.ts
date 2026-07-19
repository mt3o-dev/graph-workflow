/**
 * SqliteStoreAdapter — the default StorePort implementation (dec:3),
 * backed by better-sqlite3 over a single file (or `:memory:` for tests).
 *
 * Money.minor (bigint) is stored as TEXT, never INTEGER/REAL, so amounts
 * round-trip exactly regardless of magnitude — see migrations/001_init.sql.
 * Dedup is enforced by the `transactions.content_hash UNIQUE` constraint;
 * `save()` uses `INSERT OR IGNORE` per row and counts changes to report
 * `{ inserted, duplicates }` without ever throwing on a duplicate.
 */
import DatabaseCtor from 'better-sqlite3';
import type Database from 'better-sqlite3';
import type { Direction, Transaction } from '../../core/model/transaction.js';
import type { ImportBatch, SaveResult, StorePort } from '../../ports/store.port.js';
import { runMigrations } from './migration-runner.js';

interface TransactionRow {
	readonly booking_date: string;
	readonly value_date: string;
	readonly amount_minor: string;
	readonly currency: string;
	readonly direction: Direction;
	readonly counterparty: string;
	readonly description: string;
	readonly source_account: string;
	readonly import_batch_id: string;
	readonly content_hash: string;
}

function rowToTransaction(row: TransactionRow): Transaction {
	return {
		bookingDate: row.booking_date,
		valueDate: row.value_date,
		amount: { minor: BigInt(row.amount_minor), currency: row.currency },
		direction: row.direction,
		counterparty: row.counterparty,
		description: row.description,
		sourceAccount: row.source_account,
		importBatchId: row.import_batch_id,
		contentHash: row.content_hash
	};
}

export class SqliteStoreAdapter implements StorePort {
	private readonly db: Database.Database;

	/** `dbPath` defaults to `:memory:`; the real container passes a file path from ConfigPort. */
	constructor(dbPath: string = ':memory:') {
		this.db = new DatabaseCtor(dbPath);
	}

	async migrate(): Promise<void> {
		runMigrations(this.db);
	}

	async createBatch(
		batch: Omit<ImportBatch, 'id' | 'importedAt'> & { id: string; importedAt: string }
	): Promise<ImportBatch> {
		this.db
			.prepare(
				`INSERT INTO import_batches (id, imported_at, parser_id, source_label)
				 VALUES (@id, @importedAt, @parserId, @sourceLabel)`
			)
			.run(batch);
		return { id: batch.id, importedAt: batch.importedAt, parserId: batch.parserId, sourceLabel: batch.sourceLabel };
	}

	async save(batchId: string, txns: readonly Transaction[]): Promise<SaveResult> {
		const insert = this.db.prepare(`
			INSERT OR IGNORE INTO transactions
				(booking_date, value_date, amount_minor, currency, direction, counterparty, description, source_account, import_batch_id, content_hash)
			VALUES
				(@bookingDate, @valueDate, @amountMinor, @currency, @direction, @counterparty, @description, @sourceAccount, @importBatchId, @contentHash)
		`);

		let inserted = 0;
		let duplicates = 0;

		const runAll = this.db.transaction((rows: readonly Transaction[]) => {
			for (const t of rows) {
				const info = insert.run({
					bookingDate: t.bookingDate,
					valueDate: t.valueDate,
					amountMinor: t.amount.minor.toString(),
					currency: t.amount.currency,
					direction: t.direction,
					counterparty: t.counterparty,
					description: t.description,
					sourceAccount: t.sourceAccount,
					importBatchId: t.importBatchId,
					contentHash: t.contentHash
				});
				if (info.changes > 0) {
					inserted++;
				} else {
					duplicates++;
				}
			}
		});
		runAll(txns);

		return { batchId, inserted, duplicates };
	}

	async all(): Promise<Transaction[]> {
		const rows = this.db.prepare('SELECT * FROM transactions ORDER BY id ASC').all() as TransactionRow[];
		return rows.map(rowToTransaction);
	}

	async count(): Promise<number> {
		const row = this.db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number };
		return row.n;
	}

	async has(contentHash: string): Promise<boolean> {
		const row = this.db.prepare('SELECT 1 FROM transactions WHERE content_hash = ?').get(contentHash);
		return row !== undefined;
	}

	async close(): Promise<void> {
		this.db.close();
	}
}
