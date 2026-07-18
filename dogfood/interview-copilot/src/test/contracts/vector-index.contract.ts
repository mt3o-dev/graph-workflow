import { describe, expect, it } from 'vitest';
import type { VectorIndexPort } from '../../lib/ports/vector-index.port.ts';
import { IndexBindingMismatchError } from '../../lib/ports/vector-index.port.ts';

const BINDING = { model: 'contract-model', dimensions: 4 };

/** Shared VectorIndexPort contract: binding semantics + cosine top-k. */
export function describeVectorIndexContract(
	name: string,
	/** Must return a FRESH, empty index every call. */
	factory: () => Promise<VectorIndexPort> | VectorIndexPort
) {
	describe(`VectorIndexPort contract: ${name}`, () => {
		it('has no binding before first open, records it after', async () => {
			const index = await factory();
			expect(await index.binding()).toBeNull();
			await index.open(BINDING);
			expect(await index.binding()).toEqual(BINDING);
		});

		it('accepts re-opening with the identical binding', async () => {
			const index = await factory();
			await index.open(BINDING);
			await expect(index.open(BINDING)).resolves.toBeUndefined();
		});

		it('refuses a mismatched binding [dec:3 constraint]', async () => {
			const index = await factory();
			await index.open(BINDING);
			await expect(index.open({ model: 'other-model', dimensions: 4 })).rejects.toBeInstanceOf(
				IndexBindingMismatchError
			);
			await expect(
				index.open({ model: BINDING.model, dimensions: 8 })
			).rejects.toBeInstanceOf(IndexBindingMismatchError);
		});

		it('returns nearest neighbours first (cosine) and respects topK', async () => {
			const index = await factory();
			await index.open(BINDING);
			await index.upsert([
				{ id: 'exact', vector: [1, 0.01, 0.01, 0.01] },
				{ id: 'close', vector: [0.9, 0.4, 0.01, 0.01] },
				{ id: 'far', vector: [0.01, 0.01, 1, 0.01] }
			]);
			const hits = await index.query([1, 0.01, 0.01, 0.01], 2);
			expect(hits.map((h) => h.id)).toEqual(['exact', 'close']);
			expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
		});

		it('upsert replaces an existing entry', async () => {
			const index = await factory();
			await index.open(BINDING);
			await index.upsert([{ id: 'doc', vector: [1, 0.01, 0.01, 0.01] }]);
			await index.upsert([{ id: 'doc', vector: [0.01, 0.01, 0.01, 1] }]);
			const hits = await index.query([0.01, 0.01, 0.01, 1], 5);
			expect(hits).toHaveLength(1);
			expect(hits[0]!.id).toBe('doc');
			expect(hits[0]!.score).toBeGreaterThan(0.9);
		});
	});
}
