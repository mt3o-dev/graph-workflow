import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvParser } from './csv.parser.js';
import type { ParseContext } from '../../ports/statement-parser.port.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../../test/fixtures/statements');

const ctx: ParseContext = { sourceAccount: 'acc-1', defaultCurrency: 'EUR' };

describe('CsvParser: comma-delimited, dot-decimal, explicit amount column', () => {
	const payload = readFileSync(join(FIXTURES, 'sample-comma-dot.csv'), 'utf-8');

	it('reports id "csv"', () => {
		expect(csvParser.id).toBe('csv');
	});

	it('canParse recognizes the header as a bank CSV', () => {
		expect(csvParser.canParse(payload, ctx)).toBe(true);
	});

	it('canParse returns false on non-CSV / unrecognized payloads without throwing', () => {
		expect(csvParser.canParse('', ctx)).toBe(false);
		expect(csvParser.canParse('not,a,bank,header\n1,2,3,4', ctx)).toBe(false);
		expect(csvParser.canParse('%PDF-1.4 binary junk', ctx)).toBe(false);
	});

	it('parses every data row into a ParsedRow with exact fields', () => {
		const rows = csvParser.parse(payload, ctx);
		expect(rows).toHaveLength(4);

		expect(rows[0]).toEqual({
			bookingDate: '2026-07-01',
			valueDate: '2026-07-01',
			amount: { minor: -4567n, currency: 'USD' },
			counterparty: 'Supermart',
			description: 'Grocery shopping',
			sourceAccount: 'acc-1'
		});
	});

	it('handles a quoted description containing the delimiter', () => {
		const rows = csvParser.parse(payload, ctx);
		expect(rows[1].description).toBe('Refund, partial');
		expect(rows[1].amount).toEqual({ minor: 1200n, currency: 'USD' });
	});

	it('handles a zero-amount row', () => {
		const rows = csvParser.parse(payload, ctx);
		expect(rows[2].amount).toEqual({ minor: 0n, currency: 'USD' });
	});

	it('handles a large positive (credit/salary) row', () => {
		const rows = csvParser.parse(payload, ctx);
		expect(rows[3].amount).toEqual({ minor: 250000n, currency: 'USD' });
	});

	it('uses the explicit Currency column, not ctx.defaultCurrency, when present', () => {
		const rows = csvParser.parse(payload, ctx);
		expect(rows.every((r) => r.amount.currency === 'USD')).toBe(true);
	});
});

describe('CsvParser: semicolon-delimited, decimal-comma, debit/credit columns', () => {
	const payload = readFileSync(join(FIXTURES, 'sample-semicolon-comma.csv'), 'utf-8');

	it('canParse recognizes the semicolon-delimited header', () => {
		expect(csvParser.canParse(payload, ctx)).toBe(true);
	});

	it('parses DD.MM.YYYY dates, decimal-comma amounts, and debit/credit sign', () => {
		const rows = csvParser.parse(payload, ctx);
		expect(rows).toHaveLength(4);

		expect(rows[0]).toEqual({
			bookingDate: '2026-07-01',
			valueDate: '2026-07-01',
			amount: { minor: -4567n, currency: 'EUR' },
			counterparty: 'Grocery shopping',
			description: 'Grocery shopping',
			sourceAccount: 'acc-1'
		});
	});

	it('handles a quoted description containing a comma under a non-comma delimiter', () => {
		const rows = csvParser.parse(payload, ctx);
		expect(rows[1].description).toBe('Refund, partial');
		expect(rows[1].amount).toEqual({ minor: 1200n, currency: 'EUR' });
	});

	it('handles a zero-amount debit row', () => {
		const rows = csvParser.parse(payload, ctx);
		expect(rows[2].amount).toEqual({ minor: 0n, currency: 'EUR' });
	});

	it('falls back to ctx.defaultCurrency because the format has no Currency column', () => {
		const rows = csvParser.parse(payload, ctx);
		expect(rows.every((r) => r.amount.currency === 'EUR')).toBe(true);
	});

	it('applies a different defaultCurrency when the context changes', () => {
		const rows = csvParser.parse(payload, { sourceAccount: 'acc-2', defaultCurrency: 'PLN' });
		expect(rows.every((r) => r.amount.currency === 'PLN')).toBe(true);
		expect(rows.every((r) => r.sourceAccount === 'acc-2')).toBe(true);
	});
});
