import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../core/model/transaction.js';
import type { AssistContext } from '../../ports/assist.port.js';
import { LlmAssistAdapter, type AssistTransport } from './llm-assist.adapter.js';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		bookingDate: '2026-01-01',
		valueDate: '2026-01-01',
		amount: { minor: 1000n, currency: 'PLN' },
		direction: 'out',
		counterparty: 'Acme Corp',
		description: 'Grocery run at Acme',
		sourceAccount: 'PL00-CHECKING',
		importBatchId: 'b1',
		contentHash: 'h1',
		...overrides
	};
}

const emptyCtx: AssistContext = { classified: [] };

function fakeTransport(response: string): AssistTransport {
	return {
		async send() {
			return response;
		}
	};
}

describe('LlmAssistAdapter: mocked transport', () => {
	it('parses a well-formed mocked transport response into Suggestions', async () => {
		const transport = fakeTransport(
			JSON.stringify([
				{ groupId: 'groceries', confidence: 0.8, reason: 'similar past purchases' },
				{ groupId: 'household', confidence: 1.5, reason: 'over-confident stub, must clamp' }
			])
		);
		const adapter = new LlmAssistAdapter(transport);

		const suggestions = await adapter.suggest(makeTx(), emptyCtx);

		expect(suggestions).toEqual([
			{ groupId: 'groceries', confidence: 0.8, reason: 'similar past purchases' },
			{ groupId: 'household', confidence: 1, reason: 'over-confident stub, must clamp' }
		]);
	});

	it('drops malformed entries from an otherwise valid array response', async () => {
		const transport = fakeTransport(
			JSON.stringify([
				{ groupId: 'groceries', confidence: 0.5, reason: 'ok' },
				{ groupId: 42, confidence: 'nope', reason: 'bad shape' },
				null,
				'a string, not an object'
			])
		);
		const adapter = new LlmAssistAdapter(transport);

		const suggestions = await adapter.suggest(makeTx(), emptyCtx);

		expect(suggestions).toEqual([{ groupId: 'groceries', confidence: 0.5, reason: 'ok' }]);
	});
});

describe('LlmAssistAdapter: never throws on garbage', () => {
	it('returns [] for non-JSON transport output', async () => {
		const adapter = new LlmAssistAdapter(fakeTransport('not json at all {{{'));
		await expect(adapter.suggest(makeTx(), emptyCtx)).resolves.toEqual([]);
	});

	it('returns [] when the transport responds with a JSON object instead of an array', async () => {
		const adapter = new LlmAssistAdapter(fakeTransport(JSON.stringify({ groupId: 'x', confidence: 1, reason: 'y' })));
		await expect(adapter.suggest(makeTx(), emptyCtx)).resolves.toEqual([]);
	});

	it('returns [] (does not throw) when the transport itself rejects', async () => {
		const transport: AssistTransport = {
			async send() {
				throw new Error('simulated network failure');
			}
		};
		const adapter = new LlmAssistAdapter(transport);
		await expect(adapter.suggest(makeTx(), emptyCtx)).resolves.toEqual([]);
	});
});

describe('assist-never-commits invariant', () => {
	it('the LLM adapter source imports no store port, no adapters directory, and no network/runtime modules', async () => {
		const { readFileSync } = await import('node:fs');
		const { fileURLToPath } = await import('node:url');
		const source = readFileSync(fileURLToPath(new URL('./llm-assist.adapter.ts', import.meta.url)), 'utf-8');

		expect(source).not.toMatch(/store\.port/);
		expect(source).not.toMatch(/classification-store/);
		expect(source).not.toMatch(/from ['"](\.\.\/)+adapters\//);
		expect(source).not.toMatch(/node:(fs|net|http|https|child_process)/);
		expect(source).not.toMatch(/@anthropic-ai/);
		expect(source).not.toMatch(/fetch\(/);
	});
});
