import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { genericTabularPdfParser } from './generic-tabular-pdf.parser.js';
import type { ParseContext } from '../../ports/statement-parser.port.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../../test/fixtures/statements');

function readFixture(name: string): string {
	return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

const ctx: ParseContext = { sourceAccount: 'PL61 1090 1014 0000 0712 1981 2874', defaultCurrency: 'PLN' };

describe('genericTabularPdfParser: signed-amount fixture', () => {
	const payload = readFixture('signed-amount.txt');

	it('canParse is true for the known header signature', () => {
		expect(genericTabularPdfParser.canParse(payload, ctx)).toBe(true);
	});

	it('parses exact rows, ignoring preamble/footer/blank lines', () => {
		const rows = genericTabularPdfParser.parse(payload, ctx);
		expect(rows).toEqual([
			{
				bookingDate: '2026-06-02',
				valueDate: '2026-06-02',
				amount: { minor: -5432n, currency: 'PLN' },
				counterparty: 'GROCERY STORE WARSAW',
				description: 'GROCERY STORE WARSAW',
				sourceAccount: ctx.sourceAccount
			},
			{
				bookingDate: '2026-06-05',
				valueDate: '2026-06-06',
				amount: { minor: 350000n, currency: 'PLN' },
				counterparty: 'SALARY ACME CORP',
				description: 'SALARY ACME CORP',
				sourceAccount: ctx.sourceAccount
			},
			{
				bookingDate: '2026-06-10',
				valueDate: '2026-06-10',
				amount: { minor: -12000n, currency: 'PLN' },
				counterparty: 'ELECTRIC UTILITY CO',
				description: 'ELECTRIC UTILITY CO',
				sourceAccount: ctx.sourceAccount
			}
		]);
	});
});

describe('genericTabularPdfParser: debit-credit fixture', () => {
	const payload = readFixture('debit-credit.txt');

	it('canParse is true for the known header signature', () => {
		expect(genericTabularPdfParser.canParse(payload, ctx)).toBe(true);
	});

	it('parses exact rows with DD.MM.YYYY dates normalized to ISO and correct debit/credit sign, ignoring the footer', () => {
		const rows = genericTabularPdfParser.parse(payload, ctx);
		expect(rows).toEqual([
			{
				bookingDate: '2026-06-02',
				valueDate: '2026-06-02',
				amount: { minor: -5432n, currency: 'PLN' },
				counterparty: 'GROCERY STORE WARSAW',
				description: 'Card payment',
				sourceAccount: ctx.sourceAccount
			},
			{
				bookingDate: '2026-06-05',
				valueDate: '2026-06-05',
				amount: { minor: 350000n, currency: 'PLN' },
				counterparty: 'ACME CORP',
				description: 'Salary',
				sourceAccount: ctx.sourceAccount
			},
			{
				bookingDate: '2026-06-10',
				valueDate: '2026-06-10',
				amount: { minor: -12000n, currency: 'PLN' },
				counterparty: 'ELECTRIC UTILITY CO',
				description: 'Utility bill',
				sourceAccount: ctx.sourceAccount
			}
		]);
	});
});

describe('genericTabularPdfParser: unrecognized input', () => {
	const payload = readFixture('garbage.txt');

	it('canParse is false for text with no known header signature', () => {
		expect(genericTabularPdfParser.canParse(payload, ctx)).toBe(false);
	});

	it('parse throws rather than silently returning garbage rows', () => {
		expect(() => genericTabularPdfParser.parse(payload, ctx)).toThrow();
	});
});

describe('genericTabularPdfParser: identity', () => {
	it('has the ParserId contracted by StatementParserPort', () => {
		expect(genericTabularPdfParser.id).toBe('generic-tabular-pdf');
	});
});
