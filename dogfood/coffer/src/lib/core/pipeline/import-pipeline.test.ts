import { describe, expect, it } from 'vitest';
import type { ParseContext, StatementParser } from '../../ports/statement-parser.port.js';
import type { ParsedRow } from '../model/transaction.js';
import { money } from '../model/transaction.js';
import { InMemoryStoreAdapter } from '../../../test/fakes/in-memory-store.js';
import { runImportPipeline, selectParser } from './import-pipeline.js';

const CTX: ParseContext = { sourceAccount: 'PL00-TEST', defaultCurrency: 'PLN' };

function fakeParser(id: string, canParse: boolean, rows: ParsedRow[]): StatementParser {
	return {
		id: id as StatementParser['id'],
		canParse: () => canParse,
		parse: () => rows
	};
}

function row(overrides: Partial<ParsedRow> = {}): ParsedRow {
	return {
		bookingDate: '2026-01-01',
		valueDate: '2026-01-01',
		amount: money(-1234, 'PLN'),
		counterparty: 'ACME',
		description: 'Test row',
		sourceAccount: CTX.sourceAccount,
		...overrides
	};
}

describe('selectParser', () => {
	it('returns the first parser in registry order whose canParse is true', () => {
		const a = fakeParser('a', false, []);
		const b = fakeParser('b', true, []);
		const c = fakeParser('c', true, []);
		expect(selectParser([a, b, c], 'payload', CTX)).toBe(b);
	});

	it('returns undefined when no parser recognizes the payload', () => {
		const a = fakeParser('a', false, []);
		expect(selectParser([a], 'payload', CTX)).toBeUndefined();
	});
});

describe('runImportPipeline', () => {
	it('parses, normalizes, stamps the batch id, and persists via the store', async () => {
		const store = new InMemoryStoreAdapter();
		await store.migrate();
		const parser = fakeParser('fake', true, [row(), row({ description: 'Second row', amount: money(500, 'PLN') })]);

		const result = await runImportPipeline({ parser, payload: 'irrelevant', ctx: CTX, store, batchId: 'batch-1' });

		expect(result).toEqual({ batchId: 'batch-1', inserted: 2, duplicates: 0 });
		const stored = await store.all();
		expect(stored).toHaveLength(2);
		expect(stored.every((t) => t.importBatchId === 'batch-1')).toBe(true);
		expect(stored.every((t) => t.contentHash.length > 0)).toBe(true);
	});

	it('reports duplicates on re-import of the same rows (idempotency, dec:5)', async () => {
		const store = new InMemoryStoreAdapter();
		await store.migrate();
		const parser = fakeParser('fake', true, [row()]);

		const first = await runImportPipeline({ parser, payload: 'x', ctx: CTX, store, batchId: 'batch-1' });
		const second = await runImportPipeline({ parser, payload: 'x', ctx: CTX, store, batchId: 'batch-2' });

		expect(first).toEqual({ batchId: 'batch-1', inserted: 1, duplicates: 0 });
		expect(second).toEqual({ batchId: 'batch-2', inserted: 0, duplicates: 1 });
		expect(await store.count()).toBe(1);
	});

	it('dedups identical rows within a single batch too', async () => {
		const store = new InMemoryStoreAdapter();
		await store.migrate();
		const parser = fakeParser('fake', true, [row(), row()]);

		const result = await runImportPipeline({ parser, payload: 'x', ctx: CTX, store, batchId: 'batch-1' });

		expect(result).toEqual({ batchId: 'batch-1', inserted: 1, duplicates: 1 });
	});
});
