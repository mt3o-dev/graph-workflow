/**
 * ParsedRow → Transaction: direction derivation, batch-id stamping, and
 * content-hash computation, all in one place so every StatementParserPort
 * adapter shares identical normalization semantics ([dec:5]).
 */
import type { ParsedRow, Transaction } from '../model/transaction';
import { directionOf } from '../model/transaction';
import { normalizeForHash } from './description';
import { contentHash } from '../hash/content-hash';

/**
 * Normalize a parser's raw row into a domain Transaction: derives `direction`
 * from the amount sign, stamps `importBatchId`, and computes `contentHash`
 * from (sourceAccount, bookingDate, amount, normalizeForHash(description)).
 * The raw `description` is preserved unmodified for display.
 */
export function normalizeTransaction(row: ParsedRow, importBatchId: string): Transaction {
	const hash = contentHash({
		account: row.sourceAccount,
		bookingDate: row.bookingDate,
		amountMinor: row.amount.minor,
		currency: row.amount.currency,
		normalizedDescription: normalizeForHash(row.description)
	});
	return {
		bookingDate: row.bookingDate,
		valueDate: row.valueDate,
		amount: row.amount,
		direction: directionOf(row.amount),
		counterparty: row.counterparty,
		description: row.description,
		sourceAccount: row.sourceAccount,
		importBatchId,
		contentHash: hash
	};
}
