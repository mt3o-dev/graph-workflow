import type { Transaction } from '../core/model/transaction';

/**
 * A single group suggestion for a transaction. Suggestions are ADVISORY:
 * nothing that implements or consumes this port may write an assignment —
 * committing a suggestion is a user/rule action (tech-stack dec:7, PRD FR3).
 */
export interface Suggestion {
	readonly groupId: string;
	/** 0..1 relative confidence; consumers may threshold or rank. */
	readonly confidence: number;
	/** Short human-readable why ("12 similar descriptions in Living > Rent"). */
	readonly reason: string;
}

/** Context the assist implementation may draw on for ranking. */
export interface AssistContext {
	/** Past transactions with their committed group ids, the learning corpus. */
	readonly classified: readonly { tx: Transaction; groupIds: readonly string[] }[];
}

/**
 * Categorization assist (dec:7). Default adapter is a local heuristic; an
 * online LLM adapter exists as a stub and is OFF by default via config
 * (`assist.enabled` / `assist.adapter`). Implementations are read-only toward
 * every store — the assist-never-commits invariant is tested.
 */
export interface AssistPort {
	suggest(tx: Transaction, ctx: AssistContext): Promise<Suggestion[]>;
}
