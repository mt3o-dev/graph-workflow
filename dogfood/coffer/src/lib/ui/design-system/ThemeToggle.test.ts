// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ThemeToggle from './ThemeToggle.svelte';

afterEach(() => {
	document.documentElement.removeAttribute('data-theme');
	document.cookie = 'coffer_theme=; path=/; max-age=0';
});

describe('ThemeToggle', () => {
	it('renders as an accessible switch labelled by the caller-supplied text', () => {
		render(ThemeToggle, { label: 'Toggle theme', initial: 'light' });

		const toggle = screen.getByRole('switch', { name: 'Toggle theme' });
		expect(toggle).toBeInTheDocument();
		expect(toggle).toHaveAttribute('aria-checked', 'false');
	});

	it('flips data-theme on <html> and the aria-checked state on click', async () => {
		render(ThemeToggle, { label: 'Toggle theme', initial: 'light' });

		const toggle = screen.getByRole('switch', { name: 'Toggle theme' });
		await fireEvent.click(toggle);

		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
		expect(toggle).toHaveAttribute('aria-checked', 'true');
	});

	it('persists the choice to the coffer_theme cookie so SSR can read it next request', async () => {
		render(ThemeToggle, { label: 'Toggle theme', initial: 'light' });

		await fireEvent.click(screen.getByRole('switch'));

		expect(document.cookie).toContain('coffer_theme=dark');
	});

	it('toggles back to light on a second click', async () => {
		render(ThemeToggle, { label: 'Toggle theme', initial: 'dark' });

		const toggle = screen.getByRole('switch');
		await fireEvent.click(toggle);

		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
		expect(toggle).toHaveAttribute('aria-checked', 'false');
	});
});
