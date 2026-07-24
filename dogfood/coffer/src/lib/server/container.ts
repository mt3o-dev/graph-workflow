/**
 * The composition root (Phase 7, [dec:2]) — the single typed place that
 * constructs adapters from config and wires the core import pipeline.
 * Server-only: this file MAY import adapters and `node:` builtins.
 * Boundary-lint does not scan `src/lib/server/**` (only `src/lib/core/**`
 * and `src/lib/ports/**`).
 *
 * Constructor injection only, no DI framework, per [dec:2].
 */
import { randomUUID } from 'node:crypto';
import type { ConfigPort } from '../ports/config.port.js';
import type { ParseContext, StatementParser } from '../ports/statement-parser.port.js';
import type { PdfTextPort } from '../ports/pdf-text.port.js';
import type { SaveResult, StorePort } from '../ports/store.port.js';
import type { ClassificationStorePort } from '../ports/classification-store.port.js';
import type { AssistPort, Suggestion } from '../ports/assist.port.js';
import type { Transaction } from '../core/model/transaction.js';
import type { Rule } from '../core/model/rule.js';
import { runImportPipeline, selectParser } from '../core/pipeline/import-pipeline.js';
import { runClassification, reviewQueue as coreReviewQueue, type ClassificationRunResult } from '../core/classify/run.js';
import { recordManualCorrection, promoteCorrectionToRule } from '../core/classify/correction.js';
import { LayeredConfigAdapter } from '../adapters/config/layered-config.adapter.js';
import { SqliteStoreAdapter } from '../adapters/store/sqlite-store.adapter.js';
import { SqliteClassificationStoreAdapter } from '../adapters/store/sqlite-classification-store.adapter.js';
import { UnpdfTextAdapter } from '../adapters/pdf/unpdf-text.adapter.js';
import { csvParser } from '../adapters/parsers/csv.parser.js';
import { ofxParser } from '../adapters/parsers/ofx.parser.js';
import { genericTabularPdfParser } from '../adapters/parsers/generic-tabular-pdf.parser.js';
import { HeuristicAssistAdapter } from '../adapters/assist/heuristic-assist.adapter.js';
import { LlmAssistAdapter, type AssistTransport } from '../adapters/assist/llm-assist.adapter.js';

/**
 * Placeholder `AssistTransport` for the LLM adapter: no real Anthropic
 * transport exists yet ([node:9117c159] — the LLM adapter is a stub). Only
 * ever invoked if `config.assist.adapter === 'llm'` AND `config.assist.enabled
 * === true`, both of which default to heuristic/off ([dec:7]) — inert on
 * every default/test pnpm path, no network.
 */
class UnimplementedAssistTransport implements AssistTransport {
	async send(): Promise<string> {
		throw new Error(
			'UnimplementedAssistTransport: no real LLM transport is wired yet — set assist.adapter to "heuristic" or inject a real AssistTransport'
		);
	}
}

/** Select the AssistPort adapter named by `config.assist.adapter` ([dec:2f81ab92]). */
function buildAssistAdapter(config: ConfigPort): AssistPort {
	const kind = config.get<'heuristic' | 'llm'>('assist.adapter', 'heuristic');
	return kind === 'llm' ? new LlmAssistAdapter(new UnimplementedAssistTransport()) : new HeuristicAssistAdapter();
}

/** The full ordered set of statement-parser adapters known to this build. */
const ALL_PARSERS: readonly StatementParser[] = [genericTabularPdfParser, csvParser, ofxParser];

export interface ImportStatementInput {
	/** Already-decoded text payload (CSV/OFX file contents, or extracted PDF text). */
	readonly payload: string;
	readonly ctx: ParseContext;
	/** Human label for the source (e.g. filename), stored on the ImportBatch. */
	readonly sourceLabel: string;
}

export interface ImportPdfInput {
	readonly bytes: Uint8Array;
	readonly ctx: ParseContext;
	readonly sourceLabel: string;
}

/**
 * Container — constructs the composition root's adapters from a `ConfigPort`
 * and exposes ready-to-use import entrypoints. Construct once per process
 * (or per test), call `close()` when done with the store.
 */
export class Container {
	readonly config: ConfigPort;
	readonly store: StorePort;
	/** Classification persistence ([dec:a49130e3]) — a SECOND connection to the SAME configured db file as `store`. */
	readonly classificationStore: ClassificationStorePort;
	readonly pdfText: PdfTextPort;
	/** Parser registry, filtered + ordered by `config.import.enabledParsers` ([dec:11]). */
	readonly parsers: readonly StatementParser[];
	/** Categorization assist adapter, selected by `config.assist.adapter`; gated off by default via `config.assist.enabled` ([dec:7]/[dec:11]). */
	readonly assist: AssistPort;

	constructor(
		config: ConfigPort = new LayeredConfigAdapter(),
		storeOverride?: StorePort,
		classificationStoreOverride?: ClassificationStorePort
	) {
		this.config = config;
		const dbPath = config.get<string>('db.path', ':memory:');
		this.store = storeOverride ?? new SqliteStoreAdapter(dbPath);
		// Same configured db file as `this.store`, per [dec:a49130e3] — a
		// second connection so `assignments.tx_content_hash` genuinely
		// FK-references `transactions.content_hash`.
		this.classificationStore = classificationStoreOverride ?? new SqliteClassificationStoreAdapter(dbPath);
		this.pdfText = new UnpdfTextAdapter();
		this.assist = buildAssistAdapter(config);

		const enabledIds = config.get<string[]>('import.enabledParsers', ALL_PARSERS.map((p) => p.id));
		this.parsers = enabledIds
			.map((id) => ALL_PARSERS.find((p) => p.id === id))
			.filter((p): p is StatementParser => p !== undefined);
	}

	/** Run migrations for both stores. Must be called once before the first import (no-op for the in-memory adapters). */
	async init(): Promise<void> {
		await this.store.migrate();
		await this.classificationStore.migrate();
	}

	/**
	 * Import a text-format statement (CSV/OFX/pre-extracted tabular text):
	 * selects a parser from the registry via `canParse`, creates an
	 * `ImportBatch`, and runs the core pipeline. Throws if no registered
	 * parser recognizes the payload.
	 */
	async importStatement(input: ImportStatementInput): Promise<SaveResult> {
		const parser = selectParser(this.parsers, input.payload, input.ctx);
		if (!parser) {
			throw new Error('Container.importStatement: no enabled parser recognized this payload');
		}
		return this.runWithParser(parser, input.payload, input.ctx, input.sourceLabel);
	}

	/**
	 * Import a PDF statement: extracts text via `PdfTextPort` first, then
	 * runs the same selection + pipeline path as `importStatement`.
	 */
	async importPdf(input: ImportPdfInput): Promise<SaveResult> {
		const extracted = await this.pdfText.extract(input.bytes);
		return this.importStatement({ payload: extracted.text, ctx: input.ctx, sourceLabel: input.sourceLabel });
	}

	private async runWithParser(
		parser: StatementParser,
		payload: string,
		ctx: ParseContext,
		sourceLabel: string
	): Promise<SaveResult> {
		const batchId = randomUUID();
		await this.store.createBatch({
			id: batchId,
			importedAt: new Date().toISOString(),
			parserId: parser.id,
			sourceLabel
		});
		return runImportPipeline({ parser, payload, ctx, store: this.store, batchId });
	}

	/**
	 * Classify every stored transaction against every stored rule and persist
	 * the resulting `source: 'rule'` assignments ([dec:eb01608c]). Safe to
	 * call repeatedly — idempotent and never overwrites a manual correction
	 * (sticky-manual, [dec:efd6891c]), see `core/classify/run.ts`.
	 */
	async classify(): Promise<ClassificationRunResult> {
		const [txns, rules] = await Promise.all([this.store.all(), this.classificationStore.listRules()]);
		return runClassification(txns, rules, this.classificationStore);
	}

	/** The derived review queue: stored transactions with zero recorded assignments ([dec:efd6891c]). */
	async reviewQueue(): Promise<Transaction[]> {
		const txns = await this.store.all();
		return coreReviewQueue(txns, this.classificationStore);
	}

	/** Record a manual correction: assigns `tx` to every group in `groupIds` with `source: 'manual'`. */
	async assign(tx: Transaction, groupIds: readonly string[]): Promise<void> {
		await recordManualCorrection(tx, groupIds, this.classificationStore);
	}

	/**
	 * Promote a manual correction on `tx` to a reusable `Rule` ([dec:65e4485f]).
	 * Mints `id`/`order` when not supplied (order = current rule count, so the
	 * promoted rule evaluates after every existing rule). Does NOT re-run
	 * `classify()` itself — call it again afterwards to apply the new rule.
	 */
	async promoteToRule(
		tx: Transaction,
		groupIds: readonly string[],
		opts: { id?: string; order?: number; name?: string; stopAfter?: boolean } = {}
	): Promise<Rule> {
		const order = opts.order ?? (await this.classificationStore.listRules()).length;
		return promoteCorrectionToRule(
			tx,
			groupIds,
			{ id: opts.id ?? randomUUID(), order, name: opts.name, stopAfter: opts.stopAfter },
			this.classificationStore
		);
	}

	/**
	 * Categorization suggestions for `tx` ([dec:9117c159]). Returns `[]`
	 * without invoking the adapter when `config.assist.enabled` is false
	 * (default) — the assist-never-commits invariant plus the off-by-default
	 * gate both hold at the composition root, not just inside the adapter.
	 */
	async suggest(tx: Transaction): Promise<Suggestion[]> {
		if (!this.config.get<boolean>('assist.enabled', false)) {
			return [];
		}
		const txns = await this.store.all();
		const classified: { tx: Transaction; groupIds: readonly string[] }[] = [];
		for (const candidate of txns) {
			const assignments = await this.classificationStore.assignmentsFor(candidate.contentHash);
			if (assignments.length > 0) {
				classified.push({ tx: candidate, groupIds: assignments.map((a) => a.groupId) });
			}
		}
		return this.assist.suggest(tx, { classified });
	}

	async close(): Promise<void> {
		await this.store.close();
		await this.classificationStore.close();
	}
}

/** Convenience factory mirroring `new Container()` for call sites that prefer a function. */
export function createContainer(
	config?: ConfigPort,
	storeOverride?: StorePort,
	classificationStoreOverride?: ClassificationStorePort
): Container {
	return new Container(config, storeOverride, classificationStoreOverride);
}
