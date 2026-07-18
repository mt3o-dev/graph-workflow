<script lang="ts">
	import type { KbCategory, KbDifficulty, KbExpertise } from '../../ports/types.ts';

	type Kind = 'category' | 'difficulty' | 'expertise';
	type Value = KbCategory | KbDifficulty | KbExpertise | string;

	interface Props {
		kind: Kind;
		value: Value;
	}

	let { kind, value }: Props = $props();

	const labels: Record<string, string> = {
		frontend: 'Frontend',
		backend: 'Backend',
		theory: 'Theory',
		behavioral: 'Behavioral',
		easy: 'Easy',
		medium: 'Medium',
		hard: 'Hard',
		junior: 'Junior',
		mid: 'Mid',
		senior: 'Senior'
	};

	const label = $derived(labels[value] ?? value);
	const cssClass = $derived(`meta-tag meta-${kind}-${value}`);
</script>

<span class={cssClass}>{label}</span>

<style>
	span {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem var(--space-2);
		border-radius: var(--radius-full);
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		line-height: var(--leading-tight);
		white-space: nowrap;
	}

	.meta-category-frontend {
		background: var(--color-cat-frontend-bg);
		color: var(--color-cat-frontend);
	}
	.meta-category-backend {
		background: var(--color-cat-backend-bg);
		color: var(--color-cat-backend);
	}
	.meta-category-theory {
		background: var(--color-cat-theory-bg);
		color: var(--color-cat-theory);
	}
	.meta-category-behavioral {
		background: var(--color-cat-behavioral-bg);
		color: var(--color-cat-behavioral);
	}

	.meta-difficulty-easy {
		background: var(--color-diff-easy-bg);
		color: var(--color-diff-easy);
	}
	.meta-difficulty-medium {
		background: var(--color-diff-medium-bg);
		color: var(--color-diff-medium);
	}
	.meta-difficulty-hard {
		background: var(--color-diff-hard-bg);
		color: var(--color-diff-hard);
	}

	.meta-expertise-junior {
		background: var(--color-exp-junior-bg);
		color: var(--color-exp-junior);
	}
	.meta-expertise-mid {
		background: var(--color-exp-mid-bg);
		color: var(--color-exp-mid);
	}
	.meta-expertise-senior {
		background: var(--color-exp-senior-bg);
		color: var(--color-exp-senior);
	}
</style>
