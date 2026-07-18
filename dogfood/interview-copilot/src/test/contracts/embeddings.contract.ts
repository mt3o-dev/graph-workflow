import { describe, expect, it } from 'vitest';
import type { EmbeddingsPort } from '../../lib/ports/embeddings.port.ts';
import { cosineSimilarity } from '../fakes/vector-index.fake.ts';

/**
 * Shared EmbeddingsPort contract. Run against the fake and every
 * offline-runnable adapter (network adapters get a mocked transport).
 */
export function describeEmbeddingsContract(
	name: string,
	factory: () => Promise<EmbeddingsPort> | EmbeddingsPort,
	options: { skip?: boolean } = {}
) {
	const suite = options.skip ? describe.skip : describe;
	suite(`EmbeddingsPort contract: ${name}`, () => {
		it('declares a model id and positive dimensions', async () => {
			const port = await factory();
			expect(port.model.length).toBeGreaterThan(0);
			expect(port.dimensions).toBeGreaterThan(0);
		});

		it('returns one vector per input, each with the declared dimensions', async () => {
			const port = await factory();
			const vectors = await port.embed(['first text', 'second text', 'third text']);
			expect(vectors).toHaveLength(3);
			for (const vector of vectors) expect(vector).toHaveLength(port.dimensions);
		});

		it('is deterministic for identical input', async () => {
			const port = await factory();
			const [a] = await port.embed(['interview question about databases']);
			const [b] = await port.embed(['interview question about databases']);
			expect(a).toEqual(b);
		});

		it('embeds related texts closer than unrelated ones', async () => {
			const port = await factory();
			const [query, related, unrelated] = await port.embed([
				'Explain database transactions and the ACID guarantees.',
				'ACID transactions keep a database consistent.',
				'Flexbox centers a div horizontally in CSS.'
			]);
			expect(cosineSimilarity(query!, related!)).toBeGreaterThan(
				cosineSimilarity(query!, unrelated!)
			);
		});
	});
}
