// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ReviewScreen from './ReviewScreen.svelte';
import type { GroupDto, TransactionDto } from '$lib/server/ui/dto.js';

const tx: TransactionDto = {
	bookingDate: '2026-07-01',
	valueDate: '2026-07-01',
	amount: { minor: '1000', currency: 'PLN' },
	direction: 'in',
	counterparty: 'Employer',
	description: 'Salary',
	sourceAccount: 'PL00',
	importBatchId: 'b1',
	contentHash: 'tx1'
};

const groups: GroupDto[] = [{ id: 'g1', name: 'Salary', parentId: null, kind: 'group' }];

describe('ReviewScreen', () => {
	it('renders a queued transaction with an assign form wired to the performAssign action contract (echoed TransactionDto + groupIds)', () => {
		render(ReviewScreen, { locale: 'en', queue: [tx], groups });

		const row = screen.getByTestId('review-row');
		expect(row).toHaveAttribute('data-content-hash', 'tx1');

		const form = screen.getByTestId('review-assign-form') as HTMLFormElement;
		// The hidden `tx` field is exactly the echoed DTO `performAssign(container, txDto, groupIds)` expects back.
		const hiddenTx = form.querySelector('input[name="tx"]') as HTMLInputElement;
		expect(JSON.parse(hiddenTx.value)).toEqual(tx);

		// The group multi-select carries the candidate group ids for `groupIds`.
		const select = screen.getByTestId('review-group-select') as HTMLSelectElement;
		expect(Array.from(select.options).map((o) => o.value)).toEqual(['g1']);

		// Buttons route to the three named actions the +page.server.ts contract exposes.
		const assignButton = screen.getByRole('button', { name: 'Bind to Coffer' });
		expect(assignButton).toHaveAttribute('formaction', '?/assign');
		expect(screen.getByRole('button', { name: 'Ask the Scribes' })).toHaveAttribute('formaction', '?/suggest');
		expect(screen.getByRole('button', { name: 'Enshrine as Standing Order' })).toHaveAttribute('formaction', '?/promote');
	});

	it('shows the empty state when the review queue is empty', () => {
		render(ReviewScreen, { locale: 'en', queue: [], groups });
		expect(screen.getByRole('status')).toBeInTheDocument();
		expect(screen.queryByTestId('review-table')).not.toBeInTheDocument();
	});

	it('renders suggestions for the transaction the suggest action targeted, and a no-suggestions message when assist is off ([]))', () => {
		render(ReviewScreen, {
			locale: 'en',
			queue: [tx],
			groups,
			activeSuggestions: { contentHash: 'tx1', suggestions: [] }
		});

		expect(screen.getByTestId('review-suggestions')).toHaveTextContent('The Scribes have no counsel to offer');
	});
});
