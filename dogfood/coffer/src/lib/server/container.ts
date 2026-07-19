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
import { runImportPipeline, selectParser } from '../core/pipeline/import-pipeline.js';
import { LayeredConfigAdapter } from '../adapters/config/layered-config.adapter.js';
import { SqliteStoreAdapter } from '../adapters/store/sqlite-store.adapter.js';
import { UnpdfTextAdapter } from '../adapters/pdf/unpdf-text.adapter.js';
import { csvParser } from '../adapters/parsers/csv.parser.js';
import { ofxParser } from '../adapters/parsers/ofx.parser.js';
import { genericTabularPdfParser } from '../adapters/parsers/generic-tabular-pdf.parser.js';

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
	readonly pdfText: PdfTextPort;
	/** Parser registry, filtered + ordered by `config.import.enabledParsers` ([dec:11]). */
	readonly parsers: readonly StatementParser[];

	constructor(config: ConfigPort = new LayeredConfigAdapter(), storeOverride?: StorePort) {
		this.config = config;
		const dbPath = config.get<string>('db.path', ':memory:');
		this.store = storeOverride ?? new SqliteStoreAdapter(dbPath);
		this.pdfText = new UnpdfTextAdapter();

		const enabledIds = config.get<string[]>('import.enabledParsers', ALL_PARSERS.map((p) => p.id));
		this.parsers = enabledIds
			.map((id) => ALL_PARSERS.find((p) => p.id === id))
			.filter((p): p is StatementParser => p !== undefined);
	}

	/** Run migrations. Must be called once before the first import (no-op for the in-memory store). */
	async init(): Promise<void> {
		await this.store.migrate();
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

	async close(): Promise<void> {
		await this.store.close();
	}
}

/** Convenience factory mirroring `new Container()` for call sites that prefer a function. */
export function createContainer(config?: ConfigPort, storeOverride?: StorePort): Container {
	return new Container(config, storeOverride);
}
