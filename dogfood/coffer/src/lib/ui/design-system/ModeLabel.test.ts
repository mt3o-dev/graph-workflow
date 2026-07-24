// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ModeLabel from './ModeLabel.svelte';

describe('ModeLabel', () => {
	it('always renders the caller-supplied text — attribution mode must never be silent ([node:167451f0])', () => {
		render(ModeLabel, { mode: 'overlap', label: 'Overlap' });

		const chip = screen.getByTestId('mode-label');
		expect(chip).toBeInTheDocument();
		expect(chip).toHaveTextContent('Overlap');
		expect(chip).toHaveAttribute('data-mode', 'overlap');
		expect(chip).toHaveClass('cf-mode-label--overlap');
	});

	it('distinguishes the partition mode visually and in data-mode', () => {
		render(ModeLabel, { mode: 'partition', label: 'Podział' });

		const chip = screen.getByTestId('mode-label');
		expect(chip).toHaveTextContent('Podział');
		expect(chip).toHaveAttribute('data-mode', 'partition');
		expect(chip).toHaveClass('cf-mode-label--partition');
		expect(chip).not.toHaveClass('cf-mode-label--overlap');
	});
});
