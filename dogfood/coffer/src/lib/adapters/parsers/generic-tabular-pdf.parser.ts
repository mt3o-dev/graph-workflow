/**
 * GenericTabularPdfParser — implements StatementParser id
 * 'generic-tabular-pdf' (dec:4). Consumes EXTRACTED PDF TEXT (the `text`
 * field of PdfText; the pipeline is responsible for calling PdfTextPort and
 * passing the string through — this parser never touches a PDF library or
 * binary).
 *
 * Detection + column mapping is delegated to a {@link BankProfile}: the
 * parser finds the first line matching a known profile's header signature,
 * then hands every subsequent line to that profile's `parseRow`. Lines a
 * profile can't parse (blank lines, footers, page furniture) are silently
 * skipped, not errors.
 */
import { money } from '../../core/model/transaction.js';
import type { ParseContext, StatementParser } from '../../ports/statement-parser.port.js';
import type { ParsedRow } from '../../core/model/transaction.js';
import { bankProfiles } from './bank-profiles/index.js';
import type { BankProfile } from './bank-profiles/index.js';

/** Split extracted PDF text into lines; a form-feed page break becomes a
 *  blank line (which every profile treats as "not a data row"). */
function toLines(payload: string): string[] {
	return payload.replace(/\f/g, '\n').split(/\r\n|\r|\n/);
}

/** Find the first (profile, headerLineIndex) whose header signature matches
 *  a line in `lines`, or `null` if none match. */
function findHeaderMatch(lines: string[]): { profile: BankProfile; headerIndex: number } | null {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === '') {
			continue;
		}
		for (const profile of bankProfiles) {
			if (profile.matchesHeader(line)) {
				return { profile, headerIndex: i };
			}
		}
	}
	return null;
}

export const genericTabularPdfParser: StatementParser = {
	id: 'generic-tabular-pdf',

	canParse(payload: string): boolean {
		return findHeaderMatch(toLines(payload)) !== null;
	},

	parse(payload: string, ctx: ParseContext): ParsedRow[] {
		const lines = toLines(payload);
		const match = findHeaderMatch(lines);
		if (!match) {
			throw new Error('generic-tabular-pdf: no known bank-profile header signature found');
		}
		const { profile, headerIndex } = match;

		const rows: ParsedRow[] = [];
		for (let i = headerIndex + 1; i < lines.length; i++) {
			const candidate = profile.parseRow(lines[i]);
			if (candidate === null) {
				continue;
			}
			rows.push({
				bookingDate: candidate.bookingDate,
				valueDate: candidate.valueDate,
				amount: money(candidate.amountMinor, ctx.defaultCurrency),
				counterparty: candidate.counterparty,
				description: candidate.description,
				sourceAccount: ctx.sourceAccount
			});
		}
		return rows;
	}
};
