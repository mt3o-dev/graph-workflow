// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ImportScreen from './ImportScreen.svelte';

describe('ImportScreen', () => {
	it('lists the enabled parsers', () => {
		render(ImportScreen, { locale: 'en', enabledParserIds: ['csv', 'ofx'] });

		expect(screen.getByText('csv')).toBeInTheDocument();
		expect(screen.getByText('ofx')).toBeInTheDocument();
	});

	it('renders the result panel with inserted/duplicate counts after a successful import', () => {
		render(ImportScreen, {
			locale: 'en',
			enabledParserIds: ['csv'],
			result: { batchId: 'b1', inserted: 3, duplicates: 1 }
		});

		const panel = screen.getByTestId('import-result');
		expect(panel).toHaveTextContent('3 entries tallied into the ledger');
		expect(panel).toHaveTextContent('1 entries already known, set aside');
	});

	it('renders an error message when the import action failed', () => {
		render(ImportScreen, { locale: 'en', enabledParserIds: ['csv'], error: true });
		expect(screen.getByRole('alert')).toHaveTextContent('The scribes could not make sense of that parchment');
	});
});
