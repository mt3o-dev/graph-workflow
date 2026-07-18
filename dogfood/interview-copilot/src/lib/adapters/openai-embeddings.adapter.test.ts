import { describe, expect, it } from 'vitest';
import { describeEmbeddingsContract } from '../../test/contracts/embeddings.contract.ts';
import { bagOfWordsVector } from '../../test/fakes/embeddings.fake.ts';
import type { FetchLike } from './http.types.ts';
import { OpenAiEmbeddingsAdapter } from './openai-embeddings.adapter.ts';

/** Mocked transport: deterministic vectors so the shared contract semantics hold. */
function mockFetch(recorded: Array<{ url: string; body: Record<string, unknown> }>): FetchLike {
	return async (url, init) => {
		const body = JSON.parse(init.body) as { input: string[]; dimensions: number };
		recorded.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
		return {
			ok: true,
			status: 200,
			json: async () => ({
				data: body.input
					.map((text, index) => ({ index, embedding: bagOfWordsVector(text, body.dimensions) }))
					// Deliberately shuffled: the adapter must re-sort by index.
					.reverse()
			}),
			text: async () => ''
		};
	};
}

function makeAdapter(recorded: Array<{ url: string; body: Record<string, unknown> }> = []) {
	return new OpenAiEmbeddingsAdapter({ apiKey: 'test-key', fetchFn: mockFetch(recorded) });
}

describeEmbeddingsContract('OpenAiEmbeddingsAdapter (mocked transport)', () => makeAdapter());

describe('OpenAiEmbeddingsAdapter request shape', () => {
	it('requests text-embedding-3-small truncated to 384 dimensions [dec:3]', async () => {
		const recorded: Array<{ url: string; body: Record<string, unknown> }> = [];
		const adapter = makeAdapter(recorded);
		await adapter.embed(['hello']);
		expect(recorded[0]!.url).toBe('https://api.openai.com/v1/embeddings');
		expect(recorded[0]!.body).toMatchObject({
			model: 'text-embedding-3-small',
			dimensions: 384,
			input: ['hello']
		});
		expect(adapter.dimensions).toBe(384);
	});

	it('throws a descriptive error on a non-ok response', async () => {
		const adapter = new OpenAiEmbeddingsAdapter({
			apiKey: 'k',
			fetchFn: async () => ({
				ok: false,
				status: 401,
				json: async () => ({}),
				text: async () => 'invalid api key'
			})
		});
		await expect(adapter.embed(['x'])).rejects.toThrow(/401.*invalid api key/s);
	});
});
