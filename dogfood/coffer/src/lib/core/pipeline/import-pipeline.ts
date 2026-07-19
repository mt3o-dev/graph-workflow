/**
 * Import pipeline orchestrator (Phase 7, [dec:2] composition root, [dec:3]/
 * [dec:5] persist + dedup). PURE core: this file may import only ports and
 * other core modules — no adapters, no `node:` builtins, no framework
 * (boundary-lint enforces this).
 *
 * Flow: parse(payload) -> normalizeTransaction (stamps importBatchId +
 * contentHash) -> store.save(batchId, txns). Persistence-level dedup
 * (StorePort.save skipping already-known contentHash rows, [dec:5]) is the
 * store's job; this orchestrator only shapes the batch and delegates.
 */
import type { ParseContext, StatementParser } from '../../ports/statement-parser.port.js';
import type { SaveResult, StorePort } from '../../ports/store.port.js';
import type { ParsedRow } from '../model/transaction.js';
import { normalizeTransaction } from '../normalize/transaction.js';

/**
 * Pick the first parser in `registry` whose `canParse(payload, ctx)` returns
 * true, or `undefined` if none recognize the payload. Registry order is the
 * selection priority (mirrors `config.import.enabledParsers` ordering,
 * [dec:11], which the composition root is responsible for reflecting into
 * the registry it builds).
 */
export function selectParser(
	registry: readonly StatementParser[],
	payload: string,
	ctx: ParseContext
): StatementParser | undefined {
	return registry.find((parser) => parser.canParse(payload, ctx));
}

export interface RunImportPipelineInput {
	/** The parser to use — already selected (e.g. via {@link selectParser}) or explicitly chosen by the caller. */
	readonly parser: StatementParser;
	/** Already-decoded statement payload (text for tabular-PDF/CSV/OFX parsers). */
	readonly payload: string;
	readonly ctx: ParseContext;
	readonly store: StorePort;
	readonly batchId: string;
}

/**
 * Run one import: parse the payload with `parser`, normalize every row into
 * a `Transaction` stamped with `batchId`, and persist via `store.save`.
 * Returns the store's `SaveResult` (inserted/duplicate counts, [dec:5]).
 *
 * Does not create the `ImportBatch` record or call `store.migrate()` —
 * those are the caller's (composition root's) responsibility, since batch
 * metadata (parserId, sourceLabel, importedAt) is orchestration concern, not
 * pipeline logic.
 */
export async function runImportPipeline(input: RunImportPipelineInput): Promise<SaveResult> {
	const { parser, payload, ctx, store, batchId } = input;
	const rows: ParsedRow[] = parser.parse(payload, ctx);
	const txns = rows.map((row) => normalizeTransaction(row, batchId));
	return store.save(batchId, txns);
}
