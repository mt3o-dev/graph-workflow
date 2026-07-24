/**
 * Loader/action helper tests (coffer-ui-i18n slice 4, P3): exercise the P4
 * contract functions through a real `Container` wired to the in-memory
 * fakes, asserting every returned DTO is JSON-safe (no `bigint` typeof
 * leaks, [node:f36237e4]) and that the unclassified series reaches the
 * dashboard data ([node:0b08fbef]).
 */
import { describe, expect, it } from 'vitest';
import { Container } from '../container.js';
import { InMemoryStoreAdapter } from '../../../test/fakes/in-memory-store.js';
import { InMemoryClassificationStoreAdapter } from '../../../test/fakes/in-memory-classification-store.js';
import { LayeredConfigAdapter } from '../../adapters/config/layered-config.adapter.js';
import { UNCLASSIFIED_GROUP_ID } from '../../core/analytics/series.js';
import type { Transaction } from '../../core/model/transaction.js';
import { toTransactionDto } from './serialize.js';
import { getContainer, resetContainerSingleton } from './container-singleton.js';
import {
	loadDashboardData,
	loadImportScreen,
	loadReviewQueue,
	loadSettings,
	performAssign,
	performImport,
	performPromoteRule,
	performSuggest
} from './loaders.js';

/** Recursively assert nothing in `value` is a `bigint` (devalue/JSON safety). */
function assertNoBigint(value: unknown, path = '$'): void {
	if (typeof value === 'bigint') {
		throw new Error(`bigint leaked at ${path}`);
	}
	if (Array.isArray(value)) {
		value.forEach((v, i) => assertNoBigint(v, `${path}[${i}]`));
	} else if (value !== null && typeof value === 'object') {
		for (const [k, v] of Object.entries(value)) {
			assertNoBigint(v, `${path}.${k}`);
		}
	}
}

function tx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		bookingDate: '2026-07-01',
		valueDate: '2026-07-01',
		amount: { minor: -400n, currency: 'PLN' },
		direction: 'out',
		counterparty: 'Shop',
		description: 'Groceries',
		sourceAccount: 'PL00',
		importBatchId: 'b1',
		contentHash: 'tx1',
		...overrides
	};
}

async function seededContainer(): Promise<Container> {
	const container = new Container(
		new LayeredConfigAdapter(),
		new InMemoryStoreAdapter(),
		new InMemoryClassificationStoreAdapter()
	);
	await container.init();
	await container.store.createBatch({ id: 'b1', importedAt: '2026-07-01T00:00:00Z', parserId: 'csv', sourceLabel: 's' });
	await container.store.save('b1', [
		tx({ contentHash: 'tx1', amount: { minor: 1000n, currency: 'PLN' }, direction: 'in', description: 'Salary' }),
		tx({ contentHash: 'tx2', amount: { minor: -400n, currency: 'PLN' } })
	]);
	await container.classificationStore.upsertGroup({ id: 'g1', name: 'Groceries', parentId: null, kind: 'group' });
	await container.classificationStore.saveAssignments([{ txContentHash: 'tx2', groupId: 'g1', source: 'manual' }]);
	return container;
}

describe('loadDashboardData', () => {
	it('returns JSON-safe cashflow + byGroup SeriesSet DTOs including the unclassified series', async () => {
		const container = await seededContainer();

		const data = await loadDashboardData(container, {
			granularity: 'day',
			byGroup: { mode: 'partition', variant: 'self' }
		});

		assertNoBigint(data);
		expect(() => JSON.stringify(data)).not.toThrow();
		expect(data.cashflow).toHaveLength(1);
		expect(data.cashflow[0].grandTotalMinor).toBe('600');
		const pln = data.byGroup!.find((s) => s.currency === 'PLN')!;
		// tx1 (Salary) has no assignment -> unclassified series must be present.
		expect(pln.series.some((s) => s.id === UNCLASSIFIED_GROUP_ID)).toBe(true);

		await container.close();
	});

	it('omits byGroup when no byGroup options are passed', async () => {
		const container = await seededContainer();
		const data = await loadDashboardData(container, { granularity: 'day' });
		expect(data.byGroup).toBeUndefined();
		assertNoBigint(data);
		await container.close();
	});
});

describe('loadImportScreen / performImport', () => {
	it('lists the enabled parser ids', async () => {
		const container = await seededContainer();
		const data = await loadImportScreen(container);
		expect(data.enabledParserIds).toContain('csv');
		await container.close();
	});

	it('performImport runs a CSV text import and returns a JSON-safe SaveResultDto', async () => {
		const container = await seededContainer();
		const payload = 'date,description,counterparty,amount,currency\n2026-07-03,Coffee,Cafe,-15.50,PLN\n';

		const result = await performImport(container, {
			kind: 'text',
			payload,
			ctx: { sourceAccount: 'PL00', defaultCurrency: 'PLN' },
			sourceLabel: 'july.csv'
		});

		assertNoBigint(result);
		expect(result.inserted).toBe(1);
		expect(result.duplicates).toBe(0);
		await container.close();
	});
});

describe('loadReviewQueue / performAssign / performPromoteRule / performSuggest', () => {
	it('loadReviewQueue returns only unassigned transactions as JSON-safe DTOs', async () => {
		const container = await seededContainer();

		const queue = await loadReviewQueue(container);

		assertNoBigint(queue);
		expect(queue.map((t) => t.contentHash)).toEqual(['tx1']);
		expect(queue[0].amount.minor).toBe('1000');
		await container.close();
	});

	it('performAssign commits a manual correction from the echoed DTO, emptying the queue', async () => {
		const container = await seededContainer();
		const [queued] = await loadReviewQueue(container);

		await performAssign(container, queued, ['g1']);

		expect(await loadReviewQueue(container)).toEqual([]);
		const assignments = await container.classificationStore.assignmentsFor('tx1');
		expect(assignments).toEqual([{ txContentHash: 'tx1', groupId: 'g1', source: 'manual' }]);
		await container.close();
	});

	it('performPromoteRule mints a JSON-safe RuleDto from the echoed DTO', async () => {
		const container = await seededContainer();
		const [queued] = await loadReviewQueue(container);

		const rule = await performPromoteRule(container, queued, ['g1'], { name: 'Salary rule' });

		assertNoBigint(rule);
		expect(() => JSON.stringify(rule)).not.toThrow();
		expect(rule.assign).toEqual(['g1']);
		expect((await container.classificationStore.listRules()).map((r) => r.id)).toContain(rule.id);
		await container.close();
	});

	it('performSuggest returns [] when assist is disabled (the default)', async () => {
		const container = await seededContainer();
		const queued = toTransactionDto(tx({ contentHash: 'tx9' }));

		expect(await performSuggest(container, queued)).toEqual([]);
		await container.close();
	});
});

describe('loadSettings', () => {
	it('returns groups and rules as JSON-safe DTOs', async () => {
		const container = await seededContainer();
		await container.classificationStore.upsertRule({
			id: 'r1',
			order: 0,
			predicate: { kind: 'field', field: 'amount', op: 'lt', value: -100n },
			assign: ['g1']
		});

		const data = await loadSettings(container);

		assertNoBigint(data);
		expect(() => JSON.stringify(data)).not.toThrow();
		expect(data.groups.map((g) => g.id)).toEqual(['g1']);
		expect(data.rules).toHaveLength(1);
		expect(data.rules[0].predicate).toEqual({ kind: 'field', field: 'amount', op: 'lt', value: '-100' });
		await container.close();
	});
});

describe('getContainer singleton', () => {
	it('memoizes one Container per process and resets via resetContainerSingleton', async () => {
		resetContainerSingleton();
		const a = await getContainer();
		const b = await getContainer();
		expect(a).toBe(b);
		resetContainerSingleton();
		const c = await getContainer();
		expect(c).not.toBe(a);
		await Promise.all([a.close(), c.close()]);
		resetContainerSingleton();
	});
});
