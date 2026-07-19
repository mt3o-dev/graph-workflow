import type { Transaction } from '../core/model/transaction';

/** A record of one import run, so transactions trace to their source. */
export interface ImportBatch {
	readonly id: string;
	/** ISO 8601 timestamp the batch was created. */
	readonly importedAt: string;
	/** Parser that produced it and a human label for the source (filename). */
	readonly parserId: string;
	readonly sourceLabel: string;
}

/** Outcome of persisting a batch of parsed transactions. */
export interface SaveResult {
	readonly batchId: string;
	/** Rows newly inserted. */
	readonly inserted: number;
	/** Rows skipped because their contentHash already existed (dec:5 dedup). */
	readonly duplicates: number;
}

/**
 * Persistence boundary (dec:3). The default adapter is SQLite (better-sqlite3);
 * an in-memory adapter shares this contract for tests so a native-build failure
 * can never leave the slice unverifiable. Dedup by `Transaction.contentHash` is
 * the store's responsibility and MUST be idempotent: saving a transaction whose
 * hash already exists is a no-op counted as a duplicate, not an error.
 */
export interface StorePort {
	/** Run pending schema migrations (no-op for the in-memory adapter). */
	migrate(): Promise<void>;

	createBatch(batch: Omit<ImportBatch, 'id' | 'importedAt'> & { id: string; importedAt: string }): Promise<ImportBatch>;

	/** Persist transactions, skipping any whose contentHash already exists. */
	save(batchId: string, txns: readonly Transaction[]): Promise<SaveResult>;

	/** All stored transactions (query filters arrive in later slices). */
	all(): Promise<Transaction[]>;

	/** Count of distinct stored transactions. */
	count(): Promise<number>;

	/** True if a transaction with this contentHash is already stored. */
	has(contentHash: string): Promise<boolean>;

	close(): Promise<void>;
}
