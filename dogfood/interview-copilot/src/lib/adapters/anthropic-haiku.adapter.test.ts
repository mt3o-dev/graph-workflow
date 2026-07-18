import { describe, expect, it } from 'vitest';
import { describeAnswerContract } from '../../test/contracts/answer.contract.ts';
import type { FetchLike } from './http.types.ts';
import { AnthropicHaikuAnswerAdapter } from './anthropic-haiku.adapter.ts';

interface RecordedRequest {
	url: string;
	headers: Record<string, string>;
	body: {
		model: string;
		max_tokens: number;
		system: string;
		messages: Array<{ role: string; content: string }>;
	};
}

/** Mocked transport: drafts an answer citing the first doc id found in the prompt. */
function mockFetch(recorded: RecordedRequest[] = []): FetchLike {
	return async (url, init) => {
		const body = JSON.parse(init.body) as RecordedRequest['body'];
		recorded.push({ url, headers: init.headers, body });
		const prompt = body.messages[0]!.content;
		const cited = /\[([a-z0-9-]+)\] Q:/.exec(prompt)?.[1];
		return {
			ok: true,
			status: 200,
			json: async () => ({
				content: [
					{
						type: 'text',
						text: cited
							? `Here is a grounded draft [${cited}] based on your preparation.`
							: 'No source document applies to this question.'
					}
				]
			}),
			text: async () => ''
		};
	};
}

describeAnswerContract('AnthropicHaikuAnswerAdapter (mocked transport)', () => {
	return new AnthropicHaikuAnswerAdapter({ apiKey: 'test-key', fetchFn: mockFetch() });
});

describe('AnthropicHaikuAnswerAdapter request shape', () => {
	const question = { id: 'u1', text: 'Explain ACID?', startMs: 0, endMs: 1000 };
	const doc = {
		doc: {
			id: 'th-acid',
			question: 'Explain the ACID properties.',
			category: 'theory' as const,
			difficulty: 'medium' as const,
			expertise: 'mid' as const,
			tags: ['databases', 'acid'],
			answer: 'Atomicity, consistency, isolation, durability.'
		},
		score: 0.9
	};

	it('calls the Messages API with claude-haiku-4-5 and the api key header [dec:6]', async () => {
		const recorded: RecordedRequest[] = [];
		const adapter = new AnthropicHaikuAnswerAdapter({ apiKey: 'secret', fetchFn: mockFetch(recorded) });
		await adapter.draft({ question, window: [question], docs: [doc] });
		const request = recorded[0]!;
		expect(request.url).toBe('https://api.anthropic.com/v1/messages');
		expect(request.headers['x-api-key']).toBe('secret');
		expect(request.headers['anthropic-version']).toBe('2023-06-01');
		expect(request.body.model).toBe('claude-haiku-4-5');
		expect(request.body.messages[0]!.content).toContain('[th-acid] Q:');
		expect(request.body.messages[0]!.content).toContain('Explain ACID?');
	});

	it('extracts cited source ids and drops uncited docs', async () => {
		const adapter = new AnthropicHaikuAnswerAdapter({ apiKey: 'k', fetchFn: mockFetch() });
		const uncited = {
			...doc,
			doc: { ...doc.doc, id: 'be-caching', question: 'Caching?', answer: 'TTL.' },
			score: 0.5
		};
		const draft = await adapter.draft({ question, window: [question], docs: [doc, uncited] });
		expect(draft.sourceIds).toEqual(['th-acid']);
	});

	it('throws a descriptive error on a non-ok response', async () => {
		const adapter = new AnthropicHaikuAnswerAdapter({
			apiKey: 'k',
			fetchFn: async () => ({
				ok: false,
				status: 529,
				json: async () => ({}),
				text: async () => 'overloaded'
			})
		});
		await expect(adapter.draft({ question, window: [question], docs: [] })).rejects.toThrow(
			/529.*overloaded/s
		);
	});
});
