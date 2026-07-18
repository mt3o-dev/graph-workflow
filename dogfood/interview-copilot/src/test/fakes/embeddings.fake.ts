import type { EmbeddingsPort } from '../../lib/ports/embeddings.port.ts';

/** Deterministic FNV-1a hash of a string. */
function fnv1a(text: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash;
}

/**
 * Deterministic bag-of-words embedding: each word hashes into a bucket.
 * Texts sharing words get high cosine similarity — good enough to test
 * retrieval semantics without a model.
 */
export function bagOfWordsVector(text: string, dimensions: number): number[] {
	const vector = new Array<number>(dimensions).fill(0);
	const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
	for (const word of words) {
		vector[fnv1a(word) % dimensions]! += 1;
	}
	const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
	return norm === 0 ? vector : vector.map((x) => x / norm);
}

export class FakeEmbeddings implements EmbeddingsPort {
	readonly model = 'fake-bag-of-words';
	readonly dimensions: number;

	constructor(dimensions = 64) {
		this.dimensions = dimensions;
	}

	async embed(texts: readonly string[]): Promise<number[][]> {
		return texts.map((t) => bagOfWordsVector(t, this.dimensions));
	}
}
