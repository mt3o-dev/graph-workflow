import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Tabs from './Tabs.svelte';

const tabs = [
	{ id: 'live', label: 'Live' },
	{ id: 'history', label: 'History' }
];

describe('Tabs', () => {
	it('marks the first tab active by default', () => {
		render(Tabs, { props: { tabs } });
		expect(screen.getByRole('tab', { name: 'Live' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'false');
	});

	it('switches the active tab on click and calls onchange', async () => {
		const seen: string[] = [];
		render(Tabs, { props: { tabs, onchange: (id: string) => seen.push(id) } });
		await fireEvent.click(screen.getByRole('tab', { name: 'History' }));
		expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
		expect(seen).toEqual(['history']);
	});

	it('moves focus/selection with ArrowRight', async () => {
		render(Tabs, { props: { tabs } });
		await fireEvent.keyDown(screen.getByRole('tab', { name: 'Live' }), { key: 'ArrowRight' });
		expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
	});
});
