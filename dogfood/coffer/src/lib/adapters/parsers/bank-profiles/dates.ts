/** Date-format helpers shared by bank profiles. All parsers must normalize to
 *  ISO 8601 ("YYYY-MM-DD") — `ParsedRow.bookingDate`/`valueDate` contract. */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DOT_DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/** True if `raw` is already an ISO 8601 date ("YYYY-MM-DD"). */
export function isIsoDate(raw: string): boolean {
	return ISO_DATE_RE.test(raw);
}

/** True if `raw` is a "DD.MM.YYYY" date. */
export function isDmyDotDate(raw: string): boolean {
	return DMY_DOT_DATE_RE.test(raw);
}

/** Convert "DD.MM.YYYY" -> "YYYY-MM-DD". Throws if the shape doesn't match. */
export function dmyDotToIso(raw: string): string {
	const match = DMY_DOT_DATE_RE.exec(raw);
	if (!match) {
		throw new Error(`dmyDotToIso: not a DD.MM.YYYY date: "${raw}"`);
	}
	const [, day, month, year] = match;
	return `${year}-${month}-${day}`;
}
