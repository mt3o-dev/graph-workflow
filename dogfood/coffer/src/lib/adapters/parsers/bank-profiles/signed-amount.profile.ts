/**
 * SignedAmountProfile — layout with ISO dates and a single signed-amount
 * column (negative = out, positive = in), e.g.:
 *
 *   Date       Value Date  Description                          Amount      Balance
 *   2026-06-02 2026-06-02  GROCERY STORE WARSAW                  -54.32     1200.00
 *
 * Columns are separated by 2+ spaces (typical PDF-text-extraction artifact
 * from a fixed-width table). This profile has no separate counterparty
 * column, so `counterparty` is derived from the full description — a
 * documented simplification (real bank-specific profiles can split it).
 */
import { DECIMAL_AMOUNT_RE, decimalToMinor } from './decimal.js';
import { isIsoDate } from './dates.js';
import type { BankProfile, ParsedRowCandidate } from './types.js';

const HEADER_RE = /^Date\s{2,}Value Date\s{2,}Description\s{2,}Amount\s{2,}Balance\s*$/i;
const COLUMN_SPLIT_RE = /\s{2,}/;

export const signedAmountProfile: BankProfile = {
	id: 'signed-amount',

	matchesHeader(line: string): boolean {
		return HEADER_RE.test(line.trim());
	},

	parseRow(line: string): ParsedRowCandidate | null {
		const trimmed = line.trim();
		if (trimmed === '') {
			return null;
		}
		const columns = trimmed.split(COLUMN_SPLIT_RE);
		if (columns.length !== 5) {
			return null;
		}
		const [bookingDate, valueDate, description, amount] = columns;
		if (!isIsoDate(bookingDate) || !isIsoDate(valueDate) || !DECIMAL_AMOUNT_RE.test(amount)) {
			return null;
		}
		return {
			bookingDate,
			valueDate,
			description,
			counterparty: description,
			amountMinor: decimalToMinor(amount)
		};
	}
};
