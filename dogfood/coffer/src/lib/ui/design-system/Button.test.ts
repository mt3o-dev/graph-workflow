// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Button from './Button.svelte';

function label(text: string) {
	return createRawSnippet(() => ({
		render: () => `<span>${text}</span>`
	}));
}

describe('Button', () => {
	it('renders its children and defaults to a primary, medium, submit-safe button', () => {
		render(Button, { children: label('Inscribe') });

		const button = screen.getByRole('button', { name: 'Inscribe' });
		expect(button).toBeInTheDocument();
		expect(button).toHaveClass('cf-button--primary', 'cf-button--md');
		expect(button).toHaveAttribute('type', 'button');
	});

	it('fires onclick when enabled', async () => {
		const onclick = vi.fn();
		render(Button, { children: label('Seal It'), onclick });

		screen.getByRole('button').click();
		expect(onclick).toHaveBeenCalledOnce();
	});

	it('disables the button and marks it busy while loading', () => {
		render(Button, { children: label('Tally'), loading: true });

		const button = screen.getByRole('button');
		expect(button).toBeDisabled();
		expect(button).toHaveAttribute('aria-busy', 'true');
	});

	it('applies the requested variant and size classes', () => {
		render(Button, { children: label('Strike Out'), variant: 'danger', size: 'lg' });

		const button = screen.getByRole('button');
		expect(button).toHaveClass('cf-button--danger', 'cf-button--lg');
	});
});
