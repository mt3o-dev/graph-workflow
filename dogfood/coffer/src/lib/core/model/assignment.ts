/**
 * Domain model: Assignment ([dec:efd6891c], [dec:6] core purity).
 *
 * Pure TS only — no `node:` imports, no runtime libraries (boundary-lint
 * enforces this for everything under src/lib/core/**).
 *
 * An Assignment is one (transaction, group) pairing, keyed by the
 * transaction's `content_hash` (the domain `Transaction` has no surrogate id,
 * [dec:235e0742]) rather than a surrogate transaction id. `source` carries
 * provenance: `'rule'` rows come from the pure engine (`classify/engine.ts`,
 * which has its own narrower `Assignment` shape that structurally satisfies
 * this one), `'manual'` rows are user corrections, `'assist'` rows are a
 * committed AssistPort suggestion (P5, not produced by this slice's P3/P4
 * code). `ruleId` is only meaningful for `source: 'rule'`.
 */

export type AssignmentSource = 'rule' | 'manual' | 'assist';

export interface Assignment {
	readonly txContentHash: string;
	readonly groupId: string;
	readonly source: AssignmentSource;
	/** Only set for `source: 'rule'` — the rule that produced this row. */
	readonly ruleId?: string;
}
