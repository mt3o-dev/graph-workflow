import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ofxParser } from './ofx.parser.js';
import type { ParseContext } from '../../ports/statement-parser.port.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../../test/fixtures/statements');

const ctx: ParseContext = { sourceAccount: 'acc-1', defaultCurrency: 'EUR' };
const payload = readFileSync(join(FIXTURES, 'sample.ofx'), 'utf-8');

describe('OfxParser', () => {
	it('reports id "ofx"', () => {
		expect(ofxParser.id).toBe('ofx');
	});

	it('canParse recognizes the OFXHEADER SGML marker', () => {
		expect(ofxParser.canParse(payload, ctx)).toBe(true);
	});

	it('canParse recognizes a plain <OFX> marker even without OFXHEADER', () => {
		expect(ofxParser.canParse('<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>', ctx)).toBe(true);
	});

	it('canParse returns false on non-OFX payloads without throwing', () => {
		expect(ofxParser.canParse('', ctx)).toBe(false);
		expect(ofxParser.canParse('Date,Amount\n2026-01-01,10.00', ctx)).toBe(false);
	});

	it('parses every STMTTRN block into a ParsedRow with exact fields', () => {
		const rows = ofxParser.parse(payload, ctx);
		expect(rows).toHaveLength(4);

		expect(rows[0]).toEqual({
			bookingDate: '2026-07-01',
			valueDate: '2026-07-01',
			amount: { minor: -4567n, currency: 'PLN' },
			counterparty: 'Supermart',
			description: 'Grocery shopping, weekly',
			sourceAccount: 'acc-1'
		});
	});

	it('handles a negative/refund amount with a comma in MEMO', () => {
		const rows = ofxParser.parse(payload, ctx);
		expect(rows[1].amount).toEqual({ minor: 1200n, currency: 'PLN' });
		expect(rows[1].description).toBe('Refund, partial');
	});

	it('handles a zero-amount transaction', () => {
		const rows = ofxParser.parse(payload, ctx);
		expect(rows[2].amount).toEqual({ minor: 0n, currency: 'PLN' });
	});

	it('handles a large positive (salary) transaction', () => {
		const rows = ofxParser.parse(payload, ctx);
		expect(rows[3].amount).toEqual({ minor: 250000n, currency: 'PLN' });
		expect(rows[3].counterparty).toBe('Employer Inc');
	});

	it('uses <CURDEF> from the statement, not ctx.defaultCurrency, when present', () => {
		const rows = ofxParser.parse(payload, ctx);
		expect(rows.every((r) => r.amount.currency === 'PLN')).toBe(true);
	});

	it('falls back to ctx.defaultCurrency when the OFX payload has no CURDEF and no per-transaction CURRENCY', () => {
		const minimal = `OFXHEADER:100\n<OFX>\n<STMTTRN>\n<DTPOSTED>20260710\n<TRNAMT>-10.00\n<NAME>Test Payee\n</STMTTRN>\n</OFX>`;
		const rows = ofxParser.parse(minimal, { sourceAccount: 'acc-3', defaultCurrency: 'USD' });
		expect(rows).toEqual([
			{
				bookingDate: '2026-07-10',
				valueDate: '2026-07-10',
				amount: { minor: -1000n, currency: 'USD' },
				counterparty: 'Test Payee',
				description: 'Test Payee',
				sourceAccount: 'acc-3'
			}
		]);
	});

	it('throws when a claimed payload has a STMTTRN block missing required fields', () => {
		const broken = `OFXHEADER:100\n<OFX><STMTTRN>\n<DTPOSTED>20260710\n</STMTTRN></OFX>`;
		expect(() => ofxParser.parse(broken, ctx)).toThrow();
	});
});
