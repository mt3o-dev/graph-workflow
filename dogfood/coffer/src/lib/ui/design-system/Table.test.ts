// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Table from './Table.svelte';

describe('Table', () => {
	const columns = [
		{ key: 'description', header: 'Opis' },
		{ key: 'amount', header: 'Kwota', numeric: true }
	];
	const rows = [
		{ description: 'Coffee', amount: '-4,50 zł' },
		{ description: 'Salary', amount: '3 200,00 zł' }
	];

	it('renders column headers and preformatted cell values verbatim (no Intl inside the component)', () => {
		render(Table, { columns, rows });

		expect(screen.getByRole('columnheader', { name: 'Opis' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Kwota' })).toBeInTheDocument();
		expect(screen.getByText('Coffee')).toBeInTheDocument();
		expect(screen.getByText('-4,50 zł')).toBeInTheDocument();
		expect(screen.getByText('3 200,00 zł')).toBeInTheDocument();
	});

	it('marks numeric columns with tabular-numeral styling on both header and cells', () => {
		render(Table, { columns, rows });

		expect(screen.getByRole('columnheader', { name: 'Kwota' })).toHaveClass(
			'cf-table__th--numeric'
		);
		expect(screen.getByText('-4,50 zł')).toHaveClass('cf-table__td--numeric');
		expect(screen.getByText('Coffee')).not.toHaveClass('cf-table__td--numeric');
	});

	it('renders an accessible caption when provided', () => {
		render(Table, { columns, rows, caption: 'Ostatnie transakcje' });

		expect(screen.getByText('Ostatnie transakcje')).toBeInTheDocument();
	});

	it('renders zero rows without error', () => {
		render(Table, { columns, rows: [] });

		expect(screen.queryAllByRole('row')).toHaveLength(1); // header row only
	});
});
