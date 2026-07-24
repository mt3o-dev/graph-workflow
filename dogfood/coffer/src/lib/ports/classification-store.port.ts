import type { Group } from '../core/model/group.js';
import type { Rule } from '../core/model/rule.js';
import type { Assignment } from '../core/model/assignment.js';

/**
 * Persistence boundary for classification data ([dec:a49130e3]). Deliberately
 * a NEW port, not an extension of `StorePort` — honours the single-owner-
 * dedup constraint [node:1b48605f] by leaving `StorePort` focused on
 * transaction persistence + dedup idempotency alone.
 *
 * The default adapter (`SqliteClassificationStoreAdapter`) opens a second
 * connection to the SAME configured db file as `SqliteStoreAdapter`, so
 * `assignments.tx_content_hash` can FK-reference `transactions.content_hash`
 * (migration 002). An in-memory fake shares this contract for tests, per the
 * slice-1 native-build-independence pattern.
 *
 * P3 scope (this extension): rule CRUD + assignment persistence + the
 * derived review-queue read. `saveAssignments` is the single write path for
 * every assignment source (`'rule'` from the pure engine, `'manual'` from a
 * user correction, `'assist'` once committed) — it is idempotent and NEVER
 * overwrites an existing row for the same `(txContentHash, groupId)` pair
 * ([dec:efd6891c] sticky-manual invariant): the first assignment written for
 * a pair wins, regardless of source, mirroring the SQLite adapter's
 * `INSERT OR IGNORE` against the `UNIQUE(tx_content_hash, group_id)`
 * constraint (migration 002). This is why a rule re-eval can never clobber
 * a prior manual correction, and why re-running the engine twice never
 * produces duplicate rows.
 *
 * `unmatched()` takes the caller-known set of transaction content hashes
 * (this port does not own `Transaction` data, [dec:a49130e3]) and returns
 * the subset with zero assignments — the derived review queue.
 */
export interface ClassificationStorePort {
	/** Run pending schema migrations (no-op for the in-memory adapter). */
	migrate(): Promise<void>;

	/**
	 * Insert or update a group by `id`. Rejects (throws) if `group.parentId`
	 * would create a cycle in the tree — see `wouldCreateCycle` in
	 * `core/model/group.ts`.
	 */
	upsertGroup(group: Group): Promise<Group>;

	getGroup(id: string): Promise<Group | undefined>;

	/** All stored groups (tags and tree nodes alike), in no particular order. */
	listGroups(): Promise<Group[]>;

	deleteGroup(id: string): Promise<void>;

	/** Insert or update a rule by `id` (predicate/assign/order/stopAfter all replaced). */
	upsertRule(rule: Rule): Promise<Rule>;

	/** All stored rules, ordered ascending by `order` (ties broken by insertion/id order). */
	listRules(): Promise<Rule[]>;

	/**
	 * Persist a batch of assignments (any mix of sources). Idempotent and
	 * sticky-manual-safe: a row is only written if no assignment already
	 * exists for that `(txContentHash, groupId)` pair — see the interface
	 * doc above.
	 */
	saveAssignments(assignments: readonly Assignment[]): Promise<void>;

	/** All assignments recorded for one transaction, in no particular order. */
	assignmentsFor(contentHash: string): Promise<Assignment[]>;

	/**
	 * Every assignment in the store, in no particular order — the bulk read
	 * analytics needs for the full tx<->group join (coffer-analytics P4,
	 * `Container.analytics()`), avoiding an N+1 `assignmentsFor` loop over
	 * every transaction at dataset scale. Read-only; does not affect the
	 * sticky-manual / idempotent write invariants above.
	 */
	allAssignments(): Promise<Assignment[]>;

	/**
	 * Given a candidate set of transaction content hashes, return the subset
	 * with zero recorded assignments — the derived review queue
	 * ([dec:efd6891c]: unmatched is a read, never a separately persisted
	 * table).
	 */
	unmatched(contentHashes: readonly string[]): Promise<string[]>;

	close(): Promise<void>;
}
