import type { IndexBinding } from '../../lib/ports/types.ts';
import { IndexBindingMismatchError, type VectorIndexPort } from '../../lib/ports/vector-index.port.ts';

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i]! * (b[i] ?? 0);
		normA += a[i]! * a[i]!;
		normB += (b[i] ?? 0) * (b[i] ?? 0);
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	return denom === 0 ? 0 : dot / denom;
}

/** In-memory VectorIndexPort with the same binding semantics as the sqlite adapter. */
export class FakeVectorIndex implements VectorIndexPort {
	private stored: IndexBinding | null = null;
	private readonly entries = new Map<string, number[]>();

	async open(binding: IndexBinding): Promise<void> {
		if (this.stored === null) {
			this.stored = { ...binding };
			return;
		}
		if (this.stored.model !== binding.model || this.stored.dimensions !== binding.dimensions) {
			throw new IndexBindingMismatchError(this.stored, binding);
		}
	}

	async binding(): Promise<IndexBinding | null> {
		return this.stored ? { ...this.stored } : null;
	}

	async upsert(entries: ReadonlyArray<{ id: string; vector: readonly number[] }>): Promise<void> {
		for (const { id, vector } of entries) this.entries.set(id, [...vector]);
	}

	async query(
		vector: readonly number[],
		topK: number
	): Promise<Array<{ id: string; score: number }>> {
		return [...this.entries.entries()]
			.map(([id, v]) => ({ id, score: cosineSimilarity(vector, v) }))
			.sort((a, b) => b.score - a.score)
			.slice(0, topK);
	}
}
