/**
 * LLM-backed AssistPort adapter STUB ([node:9117c159]): wired for a future
 * Anthropic (Haiku) transport, but this file contains no network code and no
 * API keys — it depends only on a constructor-injected `AssistTransport`
 * interface so tests can drive a mocked transport and the real transport can
 * be added later without touching this file's control flow.
 *
 * Off by default: config gating (`assist.enabled` / `assist.adapter`) is the
 * composition root's job (P6), not this adapter's — this class simply
 * implements the port shape and is inert unless constructed and invoked.
 */
import type { Transaction } from '../../core/model/transaction.js';
import type { AssistContext, AssistPort, Suggestion } from '../../ports/assist.port.js';

/**
 * Minimal transport boundary the LLM adapter depends on. A real
 * implementation (e.g. an Anthropic Messages API client) lives elsewhere and
 * is injected here — this interface deliberately knows nothing about HTTP,
 * SDKs, or credentials.
 */
export interface AssistTransport {
	send(prompt: string): Promise<string>;
}

/** Shape expected from a transport response, one row per suggested group. */
interface RawSuggestion {
	groupId: string;
	confidence: number;
	reason: string;
}

function isRawSuggestion(value: unknown): value is RawSuggestion {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.groupId === 'string' &&
		typeof candidate.confidence === 'number' &&
		Number.isFinite(candidate.confidence) &&
		typeof candidate.reason === 'string'
	);
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/** Parse a transport response into Suggestions. Never throws — malformed or
 * unexpected responses (including non-JSON garbage) resolve to []. */
function parseSuggestions(raw: string): Suggestion[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) {
		return [];
	}
	const suggestions: Suggestion[] = [];
	for (const item of parsed) {
		if (isRawSuggestion(item)) {
			suggestions.push({
				groupId: item.groupId,
				confidence: clamp01(item.confidence),
				reason: item.reason
			});
		}
	}
	return suggestions;
}

/** Build the prompt sent to the transport. Kept trivial/deterministic since
 * this is a stub — a real prompt template is future work, not this phase's. */
function buildPrompt(tx: Transaction, ctx: AssistContext): string {
	const corpusSize = ctx.classified.length;
	return `Suggest classification groups for a transaction.\nDescription: ${tx.description}\nCounterparty: ${tx.counterparty}\nHistorical examples available: ${corpusSize}\nRespond as a JSON array of {"groupId","confidence","reason"}.`;
}

/**
 * LLM assist adapter stub. Never commits anything (assist-never-commits
 * invariant, [dec:7]) — `suggest` is read-only and its only side effect is
 * calling the injected transport.
 */
export class LlmAssistAdapter implements AssistPort {
	constructor(private readonly transport: AssistTransport) {}

	async suggest(tx: Transaction, ctx: AssistContext): Promise<Suggestion[]> {
		const prompt = buildPrompt(tx, ctx);
		let raw: string;
		try {
			raw = await this.transport.send(prompt);
		} catch {
			return [];
		}
		return parseSuggestions(raw);
	}
}
