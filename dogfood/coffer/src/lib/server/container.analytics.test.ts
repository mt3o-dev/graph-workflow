/**
 * Container.analytics() join test (coffer-analytics slice 3, P4): exercises
 * the real join site — store.all() + classificationStore.allAssignments()
 * (bulk read) + listGroups() — against the in-memory fakes, end to end.
 */
import { describe, expect, it } from 'vitest';
import { Container } from './container.js';
import { InMemoryStoreAdapter } from '../../test/fakes/in-memory-store.js';
import { InMemoryClassificationStoreAdapter } from '../../test/fakes/in-memory-classification-store.js';
import { LayeredConfigAdapter } from '../adapters/config/layered-config.adapter.js';

async function seededContainer(): Promise<Container> {
	const store = new InMemoryStoreAdapter();
	const classificationStore = new InMemoryClassificationStoreAdapter();
	const container = new Container(new LayeredConfigAdapter(), store, classificationStore);
	await container.init();

	await container.store.createBatch({ id: 'b1', importedAt: '2026-07-01T00:00:00Z', parserId: 'csv', sourceLabel: 's' });
	await container.store.save('b1', [
		{
			bookingDate: '2026-07-01',
			valueDate: '2026-07-01',
			amount: { minor: 1000n, currency: 'PLN' },
			direction: 'in',
			counterparty: 'ACME',
			description: 'Salary',
			sourceAccount: 'PL00',
			importBatchId: 'b1',
			contentHash: 'tx1'
		},
		{
			bookingDate: '2026-07-02',
			valueDate: '2026-07-02',
			amount: { minor: -400n, currency: 'PLN' },
			direction: 'out',
			counterparty: 'Shop',
			description: 'Groceries',
			sourceAccount: 'PL00',
			importBatchId: 'b1',
			contentHash: 'tx2'
		}
	]);
	await container.classificationStore.upsertGroup({ id: 'g1', name: 'Groceries', parentId: null, kind: 'group' });
	await container.classificationStore.saveAssignments([{ txContentHash: 'tx2', groupId: 'g1', source: 'manual' }]);

	return container;
}

describe('Container.analytics()', () => {
	it('joins store + classificationStore + groups and computes cashflow SeriesSets', async () => {
		const container = await seededContainer();

		const { cashflow } = await container.analytics({ granularity: 'day' });

		expect(cashflow).toHaveLength(1);
		expect(cashflow[0].currency).toBe('PLN');
		expect(cashflow[0].grandTotalMinor).toBe(600n);

		await container.close();
	});

	it('also computes by-group SeriesSets when byGroupOpts is passed, sharing the same join', async () => {
		const container = await seededContainer();

		const { cashflow, byGroup } = await container.analytics(
			{ granularity: 'day' },
			{ mode: 'partition', variant: 'self' }
		);

		expect(cashflow).toHaveLength(1);
		expect(byGroup).toBeDefined();
		const plnSet = byGroup!.find((s) => s.currency === 'PLN')!;
		expect(plnSet.series.find((s) => s.id === 'g1')?.points).toEqual([{ bucket: 'total', value: -400n }]);

		await container.close();
	});

	it('omits byGroup when byGroupOpts is not passed', async () => {
		const container = await seededContainer();

		const { byGroup } = await container.analytics({ granularity: 'day' });

		expect(byGroup).toBeUndefined();

		await container.close();
	});
});
