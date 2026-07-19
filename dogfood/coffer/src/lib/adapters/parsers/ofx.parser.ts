/**
 * OfxParser — implements StatementParser (id 'ofx', [dec:4]) for OFX/QFX
 * bank exports.
 *
 * OFX is SGML-ish: pre-2.0 documents have unclosed leaf tags
 * (`<DTPOSTED>20260719` with no `</DTPOSTED>`), OFX 2.0 documents are
 * well-formed XML. Both forms use the same tag vocabulary, so rather than
 * pulling in an XML parser this hand-rolls a small "extract <TAG>value up to
 * next '<' or newline" scanner scoped to each `<STMTTRN>...</STMTTRN>` block
 * — that handles both header-tagged (OFX 1.x, with an `OFXHEADER:100` SGML
 * header) and plain/XML-tagged (OFX 2.x, `<?OFX ...?>`) forms uniformly.
 *
 * Adapter (outside core): pure text in -> ParsedRow[] out, no file/DB access.
 */
import type { ParseContext, ParserId, StatementParser } from '../../ports/statement-parser.port.js';
import type { ParsedRow } from '../../core/model/transaction.js';
import { money } from '../../core/model/transaction.js';

const STMTTRN_RE = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;

/** Extract a single tag's value from within a block: `<TAG>value` up to the
 *  next `<` (unclosed/SGML form) or an explicit `</TAG>` (XML form). */
function extractTag(block: string, tag: string): string | undefined {
	const closed = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(block);
	if (closed) return closed[1].trim();
	const open = new RegExp(`<${tag}>([^<\r\n]*)`, 'i').exec(block);
	if (open) return open[1].trim();
	return undefined;
}

/** OFX dates are `YYYYMMDD` or `YYYYMMDDHHMMSS[.sss][tz]`; take the date part. */
function normalizeOfxDate(raw: string): string {
	const digits = raw.replace(/[^0-9]/g, '');
	if (digits.length < 8) {
		throw new Error(`OfxParser: unrecognized date "${raw}"`);
	}
	const y = digits.slice(0, 4);
	const mo = digits.slice(4, 6);
	const d = digits.slice(6, 8);
	return `${y}-${mo}-${d}`;
}

/** OFX amounts use a dot as decimal separator per spec, optionally signed. */
function parseOfxAmountToMinor(raw: string): bigint {
	const s = raw.trim();
	const negative = s.startsWith('-');
	const unsigned = s.replace(/^[+-]/, '');
	const [intPart, fracPart = ''] = unsigned.split('.');
	const cleanInt = intPart.replace(/[^0-9]/g, '') || '0';
	const cleanFrac = fracPart.replace(/[^0-9]/g, '').padEnd(2, '0').slice(0, 2);
	const minor = BigInt(cleanInt) * 100n + BigInt(cleanFrac || '0');
	return negative ? -minor : minor;
}

/** Locate <CURDEF>xxx (statement-level default currency), if present anywhere before the first STMTTRN. */
function findCurdef(payload: string): string | undefined {
	const m = /<CURDEF>([A-Za-z]{3})/i.exec(payload);
	return m ? m[1].toUpperCase() : undefined;
}

export class OfxParser implements StatementParser {
	readonly id: ParserId = 'ofx';

	canParse(payload: string, _ctx: ParseContext): boolean {
		if (!payload) return false;
		const head = payload.slice(0, 4096);
		return /OFXHEADER\s*:/i.test(head) || /<OFX>/i.test(head) || /<\?OFX/i.test(head);
	}

	parse(payload: string, ctx: ParseContext): ParsedRow[] {
		const defaultCurrency = findCurdef(payload) ?? ctx.defaultCurrency;
		const rows: ParsedRow[] = [];
		let match: RegExpExecArray | null;
		STMTTRN_RE.lastIndex = 0;
		while ((match = STMTTRN_RE.exec(payload)) !== null) {
			const block = match[1];
			const dtposted = extractTag(block, 'DTPOSTED');
			const trnamt = extractTag(block, 'TRNAMT');
			if (!dtposted || trnamt === undefined) {
				throw new Error('OfxParser: STMTTRN block missing DTPOSTED or TRNAMT');
			}
			const bookingDate = normalizeOfxDate(dtposted);
			const dtavail = extractTag(block, 'DTAVAIL') ?? extractTag(block, 'DTUSER');
			const valueDate = dtavail ? normalizeOfxDate(dtavail) : bookingDate;
			const minor = parseOfxAmountToMinor(trnamt);
			const currencyTag = extractTag(block, 'CURRENCY') ?? extractTag(block, 'ORIGCURRENCY');
			const currency = currencyTag ? currencyTag.toUpperCase() : defaultCurrency;
			const name = extractTag(block, 'NAME') ?? '';
			const memo = extractTag(block, 'MEMO') ?? '';
			const description = memo || name;
			const counterparty = name || memo;
			rows.push({
				bookingDate,
				valueDate,
				amount: money(minor, currency),
				counterparty,
				description,
				sourceAccount: ctx.sourceAccount
			});
		}
		return rows;
	}
}

export const ofxParser = new OfxParser();
