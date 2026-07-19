/**
 * CsvParser — implements StatementParser (id 'csv', [dec:4]) for common
 * bank-CSV export shapes.
 *
 * Supports:
 *   - delimiter auto-detection: comma or semicolon (semicolon files
 *     conventionally pair with decimal-comma numbers in EU bank exports).
 *   - a header row mapping columns by name (case-insensitive), one of two
 *     amount shapes: a single signed "amount" column, or split
 *     "debit"/"credit" columns (credit positive, debit negative/absolute).
 *   - quoted fields (RFC-4180-ish): double-quote escaping via doubled quotes,
 *     delimiters and newlines inside quotes.
 *   - decimal comma or dot in numeric fields.
 *
 * This is an adapter (outside core): no PDF/DB access, pure text in ->
 * ParsedRow[] out. Hand-rolled parser, no dependency — the format is small
 * and stable enough that a tiny state machine beats pulling in a CSV lib.
 */
import type { ParseContext, ParserId, StatementParser } from '../../ports/statement-parser.port.js';
import type { ParsedRow } from '../../core/model/transaction.js';
import { money } from '../../core/model/transaction.js';

/** Column roles this parser understands, matched case-insensitively against header names. */
type ColumnRole = 'date' | 'valueDate' | 'description' | 'counterparty' | 'amount' | 'debit' | 'credit' | 'currency';

const HEADER_ALIASES: Record<ColumnRole, string[]> = {
	date: ['date', 'booking date', 'bookingdate', 'transaction date', 'posted date', 'data'],
	valueDate: ['value date', 'valuedate', 'data waluty'],
	description: ['description', 'details', 'memo', 'title', 'opis', 'tytul', 'tytuł'],
	counterparty: ['counterparty', 'payee', 'beneficiary', 'kontrahent', 'odbiorca/nadawca', 'nadawca/odbiorca'],
	amount: ['amount', 'kwota', 'value'],
	debit: ['debit', 'withdrawal', 'obciazenie', 'obciążenie'],
	credit: ['credit', 'deposit', 'uznanie'],
	currency: ['currency', 'ccy', 'waluta']
};

/** Split a single CSV line/record set into rows of raw string fields, honoring quotes. */
function parseCsvRecords(text: string, delimiter: string): string[][] {
	const records: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	let i = 0;
	const push = () => {
		row.push(field);
		field = '';
	};
	const endRow = () => {
		push();
		// Skip fully-empty trailing rows (blank lines).
		if (!(row.length === 1 && row[0] === '')) {
			records.push(row);
		}
		row = [];
	};
	while (i < text.length) {
		const ch = text[i];
		if (inQuotes) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i += 1;
				continue;
			}
			field += ch;
			i += 1;
			continue;
		}
		if (ch === '"') {
			inQuotes = true;
			i += 1;
			continue;
		}
		if (ch === delimiter) {
			push();
			i += 1;
			continue;
		}
		if (ch === '\r') {
			i += 1;
			continue;
		}
		if (ch === '\n') {
			endRow();
			i += 1;
			continue;
		}
		field += ch;
		i += 1;
	}
	// Final record (file may or may not end with a newline).
	if (field !== '' || row.length > 0) {
		endRow();
	}
	return records;
}

/** Count occurrences of a candidate delimiter on the first non-empty line. */
function detectDelimiter(text: string): string {
	const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
	const commaCount = (firstLine.match(/,/g) ?? []).length;
	const semiCount = (firstLine.match(/;/g) ?? []).length;
	return semiCount > commaCount ? ';' : ',';
}

/** Map header cells to column roles; unrecognized columns are ignored. */
function mapHeader(header: string[]): Partial<Record<ColumnRole, number>> {
	const map: Partial<Record<ColumnRole, number>> = {};
	header.forEach((cell, idx) => {
		const normalized = cell.trim().toLowerCase();
		for (const [role, aliases] of Object.entries(HEADER_ALIASES) as [ColumnRole, string[]][]) {
			if (aliases.includes(normalized) && map[role] === undefined) {
				map[role] = idx;
			}
		}
	});
	return map;
}

/** Parse a numeric field that may use a comma or dot as the decimal separator,
 *  and may contain thousands separators (the opposite of whichever char is
 *  used as the decimal point) or a currency-adjacent space. Returns integer
 *  minor units (assumes 2 decimal digits, the common bank-export case). */
function parseAmountToMinor(raw: string): bigint {
	let s = raw.trim().replace(/\s/g, '');
	let negative = false;
	if (s.startsWith('-')) {
		negative = true;
		s = s.slice(1);
	} else if (s.startsWith('+')) {
		s = s.slice(1);
	}
	const lastComma = s.lastIndexOf(',');
	const lastDot = s.lastIndexOf('.');
	let decimalSep: ',' | '.' | null = null;
	if (lastComma !== -1 && lastComma > lastDot) {
		decimalSep = ',';
	} else if (lastDot !== -1) {
		decimalSep = '.';
	}
	let integerPart: string;
	let fractionPart: string;
	if (decimalSep === null) {
		integerPart = s;
		fractionPart = '';
	} else {
		const idx = decimalSep === ',' ? lastComma : lastDot;
		integerPart = s.slice(0, idx);
		fractionPart = s.slice(idx + 1);
	}
	// Strip thousands separators (any remaining , or . in the integer part).
	integerPart = integerPart.replace(/[.,]/g, '');
	fractionPart = fractionPart.replace(/[.,]/g, '').padEnd(2, '0').slice(0, 2);
	if (integerPart === '') integerPart = '0';
	const minor = BigInt(integerPart) * 100n + BigInt(fractionPart || '0');
	return negative ? -minor : minor;
}

/** True if a header row plausibly identifies a bank CSV: at least a date
 *  column and either an amount column or a debit/credit pair. */
function looksLikeBankCsv(header: string[]): boolean {
	const map = mapHeader(header);
	const hasAmount = map.amount !== undefined || (map.debit !== undefined && map.credit !== undefined);
	return map.date !== undefined && hasAmount;
}

export class CsvParser implements StatementParser {
	readonly id: ParserId = 'csv';

	canParse(payload: string, _ctx: ParseContext): boolean {
		if (!payload || !payload.trim()) return false;
		try {
			const delimiter = detectDelimiter(payload);
			const records = parseCsvRecords(payload, delimiter);
			if (records.length === 0) return false;
			return looksLikeBankCsv(records[0]);
		} catch {
			return false;
		}
	}

	parse(payload: string, ctx: ParseContext): ParsedRow[] {
		const delimiter = detectDelimiter(payload);
		const records = parseCsvRecords(payload, delimiter);
		if (records.length === 0) {
			throw new Error('CsvParser: empty payload');
		}
		const [header, ...dataRows] = records;
		const map = mapHeader(header);
		if (map.date === undefined) {
			throw new Error('CsvParser: could not locate a date column in header');
		}
		const rows: ParsedRow[] = [];
		for (const cells of dataRows) {
			if (cells.length === 1 && cells[0].trim() === '') continue;
			const dateRaw = map.date !== undefined ? cells[map.date] : undefined;
			if (!dateRaw || !dateRaw.trim()) continue;
			const bookingDate = normalizeDate(dateRaw);
			const valueDate = map.valueDate !== undefined ? normalizeDate(cells[map.valueDate]) : bookingDate;
			let minor: bigint;
			if (map.amount !== undefined) {
				minor = parseAmountToMinor(cells[map.amount]);
			} else if (map.debit !== undefined && map.credit !== undefined) {
				const debitRaw = cells[map.debit]?.trim() ?? '';
				const creditRaw = cells[map.credit]?.trim() ?? '';
				if (creditRaw !== '') {
					minor = parseAmountToMinor(creditRaw);
					if (minor < 0n) minor = -minor;
				} else if (debitRaw !== '') {
					const parsed = parseAmountToMinor(debitRaw);
					minor = parsed > 0n ? -parsed : parsed;
				} else {
					minor = 0n;
				}
			} else {
				throw new Error('CsvParser: header has no amount or debit/credit columns');
			}
			const currency = map.currency !== undefined && cells[map.currency]?.trim() ? cells[map.currency].trim().toUpperCase() : ctx.defaultCurrency;
			const description = map.description !== undefined ? (cells[map.description] ?? '').trim() : '';
			const counterparty = map.counterparty !== undefined ? (cells[map.counterparty] ?? '').trim() : description;
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

/** Normalize a date cell to ISO 8601 (YYYY-MM-DD). Accepts YYYY-MM-DD as-is,
 *  and DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY as common EU bank-export shapes. */
function normalizeDate(raw: string): string {
	const s = raw.trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
	const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
	if (m) {
		const [, d, mo, y] = m;
		return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
	}
	throw new Error(`CsvParser: unrecognized date format "${raw}"`);
}

export const csvParser = new CsvParser();
