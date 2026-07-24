/**
 * Shared ClassificationStorePort contract (P1, [dec:a49130e3]). One
 * assertion suite, run against every implementation (the in-memory fake,
 * always; the SQLite adapter, when the native build is available) so both
 * stay behaviorally identical — mirrors `store.contract.ts`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Group } from '../../lib/core/model/group.js';
import type { Rule } from '../../lib/core/model/rule.js';
import type { Assignment } from '../../lib/core/model/assignment.js';
import type { ClassificationStorePort } from '../../lib/ports/classification-store.port.js';

export interface ClassificationStoreContractOptions {
	/** Produce a fresh, unmigrated store instance for each test. */
	createStore: () => ClassificationStorePort | Promise<ClassificationStorePort>;
	/**
	 * Optional hook for adapters whose `assignments` table has a REAL FK to a
	 * `transactions` table (the SQLite adapter, R2) — given the freshly
	 * created `store` and a set of content hashes the assignment tests are
	 * about to reference, ensure a matching transaction row exists for each
	 * one (e.g. via a paired `SqliteStoreAdapter` on the same db file) before
	 * `saveAssignments` is called. The in-memory fake has no such constraint
	 * and can omit this entirely.
	 */
	seedTransactions?: (store: ClassificationStorePort, contentHashes: readonly string[]) => Promise<void>;
}

function makeGroup(overrides: Partial<Group> = {}): Group {
	return {
		id: 'g1',
		name: 'Groceries',
		parentId: null,
		kind: 'group',
		...overrides
	};
}

function makeRule(overrides: Partial<Rule> = {}): Rule {
	return {
		id: 'r1',
		order: 0,
		predicate: { kind: 'field', field: 'counterparty', op: 'equals', value: 'ACME' },
		assign: ['g1'],
		...overrides
	};
}

/** Register the shared ClassificationStorePort contract as a `describe` block. Call inside your own `describe(...)`. */
export function runClassificationStoreContract(options: ClassificationStoreContractOptions): void {
	describe('ClassificationStorePort contract', () => {
		let store: ClassificationStorePort;

		beforeEach(async () => {
			store = await options.createStore();
			await store.migrate();
		});

		afterEach(async () => {
			await store.close();
		});

		it('migrate() is idempotent', async () => {
			await store.migrate();
			await store.migrate();
			expect(await store.listGroups()).toEqual([]);
		});

		it('upsertGroup() then getGroup() round-trips a tree-root group', async () => {
			const group = makeGroup({ id: 'g1', name: 'Groceries', parentId: null, kind: 'group' });
			await store.upsertGroup(group);

			expect(await store.getGroup('g1')).toEqual(group);
		});

		it('upsertGroup() supports a nested child and a flat, parentless tag', async () => {
			await store.upsertGroup(makeGroup({ id: 'root', name: 'Food', parentId: null, kind: 'group' }));
			await store.upsertGroup(makeGroup({ id: 'child', name: 'Snacks', parentId: 'root', kind: 'group' }));
			await store.upsertGroup(makeGroup({ id: 'tag1', name: 'Recurring', parentId: null, kind: 'tag' }));

			const all = await store.listGroups();
			expect(all).toHaveLength(3);
			expect(await store.getGroup('child')).toEqual({
				id: 'child',
				name: 'Snacks',
				parentId: 'root',
				kind: 'group'
			});
			expect(await store.getGroup('tag1')).toEqual({
				id: 'tag1',
				name: 'Recurring',
				parentId: null,
				kind: 'tag'
			});
		});

		it('upsertGroup() on an existing id updates it in place (no duplicate)', async () => {
			await store.upsertGroup(makeGroup({ id: 'g1', name: 'Old', parentId: null, kind: 'group' }));
			await store.upsertGroup(makeGroup({ id: 'g1', name: 'New', parentId: null, kind: 'group' }));

			expect(await store.listGroups()).toHaveLength(1);
			expect(await store.getGroup('g1')).toEqual({ id: 'g1', name: 'New', parentId: null, kind: 'group' });
		});

		it('upsertGroup() rejects a parentId that would create a cycle', async () => {
			await store.upsertGroup(makeGroup({ id: 'a', name: 'A', parentId: null, kind: 'group' }));
			await store.upsertGroup(makeGroup({ id: 'b', name: 'B', parentId: 'a', kind: 'group' }));

			await expect(
				store.upsertGroup(makeGroup({ id: 'a', name: 'A', parentId: 'b', kind: 'group' }))
			).rejects.toThrow();
		});

		it('upsertGroup() rejects a group being its own parent', async () => {
			await expect(
				store.upsertGroup(makeGroup({ id: 'self', name: 'Self', parentId: 'self', kind: 'group' }))
			).rejects.toThrow();
		});

		it('getGroup() returns undefined for an unknown id', async () => {
			expect(await store.getGroup('does-not-exist')).toBeUndefined();
		});

		it('deleteGroup() removes a group; deleting an unknown id is a no-op', async () => {
			await store.upsertGroup(makeGroup({ id: 'g1' }));
			await store.deleteGroup('g1');

			expect(await store.getGroup('g1')).toBeUndefined();
			await expect(store.deleteGroup('never-existed')).resolves.toBeUndefined();
		});

		it('listGroups() reflects deletes', async () => {
			await store.upsertGroup(makeGroup({ id: 'g1' }));
			await store.upsertGroup(makeGroup({ id: 'g2', name: 'Rent' }));
			await store.deleteGroup('g1');

			const all = await store.listGroups();
			expect(all.map((g) => g.id)).toEqual(['g2']);
		});

		it('upsertRule() then listRules() round-trips a rule, ordered ascending by order', async () => {
			await store.upsertRule(makeRule({ id: 'r2', order: 5 }));
			await store.upsertRule(makeRule({ id: 'r1', order: 1 }));

			const rules = await store.listRules();
			expect(rules.map((r) => r.id)).toEqual(['r1', 'r2']);
			expect(rules[0]).toEqual(makeRule({ id: 'r1', order: 1 }));
		});

		it('upsertRule() supports amount predicates (bigint round-trips) and all/any combinators', async () => {
			const rule = makeRule({
				id: 'r-amount',
				order: 0,
				predicate: {
					kind: 'all',
					predicates: [
						{ kind: 'field', field: 'amount', op: 'between', value: [100n, 500n] },
						{
							kind: 'any',
							predicates: [{ kind: 'field', field: 'description', op: 'contains', value: 'coffee' }]
						}
					]
				},
				assign: ['g1', 'g2'],
				stopAfter: true
			});
			await store.upsertRule(rule);

			const [stored] = await store.listRules();
			expect(stored).toEqual(rule);
		});

		it('upsertRule() on an existing id updates it in place (no duplicate)', async () => {
			await store.upsertRule(makeRule({ id: 'r1', order: 0, name: 'Old' }));
			await store.upsertRule(makeRule({ id: 'r1', order: 3, name: 'New' }));

			const rules = await store.listRules();
			expect(rules).toHaveLength(1);
			expect(rules[0]).toEqual(makeRule({ id: 'r1', order: 3, name: 'New' }));
		});

		it('saveAssignments() then assignmentsFor() round-trips', async () => {
			await store.upsertGroup(makeGroup());
			await options.seedTransactions?.(store, ['tx1']);
			const assignment: Assignment = { txContentHash: 'tx1', groupId: 'g1', source: 'manual' };

			await store.saveAssignments([assignment]);

			expect(await store.assignmentsFor('tx1')).toEqual([assignment]);
		});

		it('saveAssignments() persists rule-sourced rows with ruleId', async () => {
			await store.upsertGroup(makeGroup());
			await store.upsertRule(makeRule());
			await options.seedTransactions?.(store, ['tx1']);
			const assignment: Assignment = { txContentHash: 'tx1', groupId: 'g1', source: 'rule', ruleId: 'r1' };

			await store.saveAssignments([assignment]);

			expect(await store.assignmentsFor('tx1')).toEqual([assignment]);
		});

		it('saveAssignments() is idempotent: re-saving the same (tx, group) pair does not duplicate', async () => {
			await store.upsertGroup(makeGroup());
			await store.upsertRule(makeRule());
			await options.seedTransactions?.(store, ['tx1']);
			const assignment: Assignment = { txContentHash: 'tx1', groupId: 'g1', source: 'rule', ruleId: 'r1' };

			await store.saveAssignments([assignment]);
			await store.saveAssignments([assignment]);

			expect(await store.assignmentsFor('tx1')).toEqual([assignment]);
		});

		it('saveAssignments() sticky-manual: a later rule row for the same (tx, group) pair never overwrites an existing manual one', async () => {
			await store.upsertGroup(makeGroup());
			await store.upsertRule(makeRule());
			await options.seedTransactions?.(store, ['tx1']);
			const manual: Assignment = { txContentHash: 'tx1', groupId: 'g1', source: 'manual' };
			const ruleRow: Assignment = { txContentHash: 'tx1', groupId: 'g1', source: 'rule', ruleId: 'r1' };

			await store.saveAssignments([manual]);
			await store.saveAssignments([ruleRow]);

			expect(await store.assignmentsFor('tx1')).toEqual([manual]);
		});

		it('saveAssignments() allows multiple distinct groups on the same transaction (many-to-many)', async () => {
			await store.upsertGroup(makeGroup());
			await store.upsertGroup(makeGroup({ id: 'g2', name: 'Rent' }));
			await options.seedTransactions?.(store, ['tx1']);
			const a: Assignment = { txContentHash: 'tx1', groupId: 'g1', source: 'manual' };
			const b: Assignment = { txContentHash: 'tx1', groupId: 'g2', source: 'manual' };

			await store.saveAssignments([a, b]);

			const rows = await store.assignmentsFor('tx1');
			expect(rows).toHaveLength(2);
			expect(rows.map((r) => r.groupId).sort()).toEqual(['g1', 'g2']);
		});

		it('assignmentsFor() returns an empty array for a transaction with no assignments', async () => {
			expect(await store.assignmentsFor('never-assigned')).toEqual([]);
		});

		it('unmatched() returns exactly the candidate hashes with zero assignments', async () => {
			await store.upsertGroup(makeGroup());
			await options.seedTransactions?.(store, ['tx1', 'tx2', 'tx3']);
			await store.saveAssignments([{ txContentHash: 'tx1', groupId: 'g1', source: 'manual' }]);

			const result = await store.unmatched(['tx1', 'tx2', 'tx3']);

			expect(result.sort()).toEqual(['tx2', 'tx3']);
		});

		it('unmatched() returns an empty array when every candidate has an assignment', async () => {
			await store.upsertGroup(makeGroup());
			await options.seedTransactions?.(store, ['tx1']);
			await store.saveAssignments([{ txContentHash: 'tx1', groupId: 'g1', source: 'manual' }]);

			expect(await store.unmatched(['tx1'])).toEqual([]);
		});

		it('unmatched() on an empty candidate list returns an empty array', async () => {
			expect(await store.unmatched([])).toEqual([]);
		});
	});
}
