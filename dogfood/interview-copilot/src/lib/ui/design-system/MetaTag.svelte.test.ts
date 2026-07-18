import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import MetaTag from './MetaTag.svelte';

describe('MetaTag', () => {
	it('renders a category chip with its semantic class', () => {
		render(MetaTag, { props: { kind: 'category', value: 'backend' } });
		expect(screen.getByText('Backend')).toHaveClass('meta-category-backend');
	});

	it('renders a difficulty chip distinct from a same-named expertise chip', () => {
		const { container } = render(MetaTag, { props: { kind: 'difficulty', value: 'hard' } });
		expect(container.querySelector('.meta-difficulty-hard')).not.toBeNull();
	});

	it('renders an expertise chip', () => {
		render(MetaTag, { props: { kind: 'expertise', value: 'senior' } });
		expect(screen.getByText('Senior')).toHaveClass('meta-expertise-senior');
	});
});
