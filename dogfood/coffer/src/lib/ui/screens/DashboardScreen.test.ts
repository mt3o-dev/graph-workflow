// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DashboardScreen from './DashboardScreen.svelte';
import { UNCLASSIFIED_GROUP_ID } from '$lib/core/analytics/series.js';
import type { SeriesSetDto } from '$lib/server/ui/dto.js';

const cashflow: SeriesSetDto[] = [
	{
		currency: 'PLN',
		grandTotalMinor: '600',
		series: [
			{ id: 'income', label: 'Income', mode: 'overlap', currency: 'PLN', points: [{ bucket: '2026-07-01', value: '1000' }] },
			{ id: 'outcome', label: 'Outcome', mode: 'overlap', currency: 'PLN', points: [{ bucket: '2026-07-01', value: '-400' }] },
			{ id: 'net', label: 'Net', mode: 'overlap', currency: 'PLN', points: [{ bucket: '2026-07-01', value: '600' }] }
		]
	}
];

const byGroup: SeriesSetDto[] = [
	{
		currency: 'PLN',
		grandTotalMinor: '1400',
		series: [
			{ id: 'g1', label: 'Groceries', mode: 'partition', currency: 'PLN', points: [{ bucket: 'total', value: '400' }] },
			{
				id: UNCLASSIFIED_GROUP_ID,
				label: 'Unclassified',
				mode: 'partition',
				currency: 'PLN',
				points: [{ bucket: 'total', value: '1000' }]
			}
		]
	}
];

const noopHandlers = {
	onGranularityChange: vi.fn(),
	onModeChange: vi.fn(),
	onVariantChange: vi.fn()
};

describe('DashboardScreen', () => {
	it('renders the cashflow chart series and, when byGroup is present, the mode label and a distinct unclassified series ([node:0b08fbef], [node:167451f0])', () => {
		render(DashboardScreen, {
			locale: 'en',
			cashflow,
			byGroup,
			granularity: 'month',
			mode: 'partition',
			variant: 'self',
			...noopHandlers
		});

		expect(screen.getByTestId('dashboard-screen')).toBeInTheDocument();
		expect(screen.getAllByTestId('cashflow-series')).toHaveLength(3);

		// Attribution mode label is ALWAYS visible for a group chart.
		const modeLabel = screen.getByTestId('mode-label');
		expect(modeLabel).toBeInTheDocument();
		expect(modeLabel).toHaveAttribute('data-mode', 'partition');

		// __unclassified__ renders distinctly, in its own row, with its own label.
		const unclassifiedRow = screen.getByTestId('by-group-unclassified');
		expect(unclassifiedRow).toBeInTheDocument();
		expect(unclassifiedRow).toHaveAttribute('data-group-id', UNCLASSIFIED_GROUP_ID);
		expect(unclassifiedRow.querySelector('.cf-bygroup-chart__bar--unclassified')).not.toBeNull();

		const classifiedRow = screen.getByTestId('by-group-row');
		expect(classifiedRow).toHaveAttribute('data-group-id', 'g1');
	});

	it('shows the empty state when no cashflow points exist yet', () => {
		render(DashboardScreen, {
			locale: 'en',
			cashflow: [],
			granularity: 'month',
			mode: 'partition',
			variant: 'self',
			...noopHandlers
		});

		expect(screen.getByRole('status')).toBeInTheDocument();
		expect(screen.queryByTestId('cashflow-chart')).not.toBeInTheDocument();
	});
});
