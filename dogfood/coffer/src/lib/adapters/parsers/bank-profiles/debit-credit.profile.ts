/**
 * DebitCreditProfile — layout with DD.MM.YYYY dates, a separate counterparty
 * column, and split debit/credit columns (only one populated per row; the
 * other holds a "-" placeholder, a common bank-PDF text-extraction shape),
 * e.g.:
 *
 *   Date        Counterparty              Description             Debit       Credit
 *   02.06.2026  GROCERY STORE WARSAW      Card payment              54.32       -
 *   05.06.2026  ACME CORP                 Salary                    -           3500.00
 *
 * Debit is money out (negative amountMinor); credit is money in (positive).
 * `valueDate` is not carried by this layout, so it equals `bookingDate`.
 */
import { DECIMAL_AMOUNT_RE, decimalToMinor } from './decimal.js';
import { dmyDotToIso, isDmyDotDate } from './dates.js';
import type { BankProfile, ParsedRowCandidate } from './types.js';

const HEADER_RE =
	/^Date\s{2,}Counterparty\s{2,}Description\s{2,}Debit\s{2,}Credit\s*$/i;
const COLUMN_SPLIT_RE = /\s{2,}/;
const EMPTY_PLACEHOLDER = '-';

export const debitCreditProfile: BankProfile = {
	id: 'debit-credit',

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
		const [date, counterparty, description, debit, credit] = columns;
		if (!isDmyDotDate(date)) {
			return null;
		}
		const debitIsAmount = DECIMAL_AMOUNT_RE.test(debit);
		const creditIsAmount = DECIMAL_AMOUNT_RE.test(credit);
		const debitIsEmpty = debit === EMPTY_PLACEHOLDER;
		const creditIsEmpty = credit === EMPTY_PLACEHOLDER;
		// Exactly one of debit/credit must be a real amount, the other empty.
		if (!((debitIsAmount && creditIsEmpty) || (creditIsAmount && debitIsEmpty))) {
			return null;
		}
		const bookingDate = dmyDotToIso(date);
		const amountMinor = debitIsAmount ? -decimalToMinor(debit) : decimalToMinor(credit);
		return {
			bookingDate,
			valueDate: bookingDate,
			description,
			counterparty,
			amountMinor
		};
	}
};
