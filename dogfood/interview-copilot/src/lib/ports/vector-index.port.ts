import type { IndexBinding } from './types.ts';

/**
 * Vector similarity index. An index is bound to the embedding model that
 * built it: `open` records the binding on first use and refuses a mismatch.
 */
export interface VectorIndexPort {
	/**
	 * Open (or create) the index for the given model geometry.
	 * @throws IndexBindingMismatchError when the stored binding differs.
	 */
	open(binding: IndexBinding): Promise<void>;
	/** The recorded binding, or null when the index is empty/new. */
	binding(): Promise<IndexBinding | null>;
	upsert(entries: ReadonlyArray<{ id: string; vector: readonly number[] }>): Promise<void>;
	/** Top-k nearest by cosine similarity, best first. Score = cosine similarity. */
	query(vector: readonly number[], topK: number): Promise<Array<{ id: string; score: number }>>;
}

export class IndexBindingMismatchError extends Error {
	constructor(
		readonly stored: IndexBinding,
		readonly requested: IndexBinding
	) {
		super(
			`Vector index is bound to ${stored.model} (${stored.dimensions}d) but was opened with ` +
				`${requested.model} (${requested.dimensions}d); reindex before switching embedding adapters`
		);
		this.name = 'IndexBindingMismatchError';
	}
}
