<script lang="ts">
	import type { Snippet } from 'svelte';
	import Spinner from './Spinner.svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		'aria-label'?: string;
		'data-testid'?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		loading = false,
		'aria-label': ariaLabel,
		'data-testid': testId,
		onclick,
		children
	}: Props = $props();
</script>

<button
	class="btn btn-{variant} btn-{size}"
	{type}
	disabled={disabled || loading}
	aria-label={ariaLabel}
	aria-busy={loading}
	data-testid={testId}
	onclick={onclick}
>
	{#if loading}
		<span aria-hidden="true"><Spinner size="sm" /></span>
	{/if}
	<span class="btn-label">{@render children()}</span>
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		font-family: inherit;
		font-weight: var(--weight-medium);
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		transition:
			background-color var(--duration-base) var(--ease-standard),
			border-color var(--duration-base) var(--ease-standard),
			color var(--duration-base) var(--ease-standard),
			opacity var(--duration-base) var(--ease-standard);
	}

	.btn:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.btn-md {
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-base);
	}

	.btn-sm {
		padding: var(--space-1) var(--space-3);
		font-size: var(--text-sm);
	}

	.btn-primary {
		background: var(--color-brand);
		color: var(--color-text-on-brand);
	}

	.btn-primary:not(:disabled):hover {
		background: var(--color-brand-hover);
	}

	.btn-secondary {
		background: var(--color-bg-raised);
		color: var(--color-text);
		border-color: var(--color-border-strong);
	}

	.btn-secondary:not(:disabled):hover {
		background: var(--color-bg-sunken);
	}

	.btn-ghost {
		background: transparent;
		color: var(--color-text);
	}

	.btn-ghost:not(:disabled):hover {
		background: var(--color-bg-sunken);
	}

	.btn-danger {
		background: var(--color-danger);
		color: var(--color-text-on-brand);
	}

	.btn-danger:not(:disabled):hover {
		background: var(--color-danger-600);
	}

	.btn-label {
		display: inline-flex;
		align-items: center;
	}
</style>
