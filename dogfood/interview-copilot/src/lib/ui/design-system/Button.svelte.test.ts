import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ButtonHarness from './test-harness/ButtonHarness.svelte';

describe('Button', () => {
	it('renders its label', () => {
		render(ButtonHarness, { props: { label: 'Start session' } });
		expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument();
	});

	it('fires onclick when clicked', async () => {
		const onclick = vi.fn();
		render(ButtonHarness, { props: { label: 'Click me', onclick } });
		await fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
		expect(onclick).toHaveBeenCalledOnce();
	});

	it('disables the button and marks it busy while loading', () => {
		render(ButtonHarness, { props: { label: 'Save', loading: true } });
		const button = screen.getByRole('button', { name: 'Save' });
		expect(button).toBeDisabled();
		expect(button).toHaveAttribute('aria-busy', 'true');
	});

	it('applies the danger variant class', () => {
		render(ButtonHarness, { props: { label: 'Stop', variant: 'danger' } });
		expect(screen.getByRole('button', { name: 'Stop' })).toHaveClass('btn-danger');
	});
});
