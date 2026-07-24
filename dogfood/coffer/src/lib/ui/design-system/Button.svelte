<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Variant, Size } from './types';

	interface Props {
		variant?: Variant;
		size?: Size;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
		[key: string]: unknown;
	}

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		loading = false,
		onclick,
		children,
		...rest
	}: Props = $props();
</script>

<button
	{type}
	class="cf-button cf-focus-ring cf-button--{variant} cf-button--{size}"
	disabled={disabled || loading}
	aria-busy={loading || undefined}
	{onclick}
	{...rest}
>
	{#if loading}
		<span class="cf-button__spinner" aria-hidden="true"></span>
	{/if}
	<span class="cf-button__label">{@render children()}</span>
</button>

<style>
	.cf-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--cf-space-2);
		font-family: var(--cf-font-ui);
		font-weight: var(--cf-font-weight-medium);
		border-radius: var(--cf-radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		transition:
			background-color var(--cf-motion-fast) var(--cf-motion-ease),
			border-color var(--cf-motion-fast) var(--cf-motion-ease),
			opacity var(--cf-motion-fast) var(--cf-motion-ease);
	}

	.cf-button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.cf-button--sm {
		font-size: var(--cf-font-size-sm);
		padding: var(--cf-space-1) var(--cf-space-3);
	}
	.cf-button--md {
		font-size: var(--cf-font-size-md);
		padding: var(--cf-space-2) var(--cf-space-4);
	}
	.cf-button--lg {
		font-size: var(--cf-font-size-lg);
		padding: var(--cf-space-3) var(--cf-space-5);
	}

	.cf-button--primary {
		background: var(--cf-color-accent);
		color: var(--cf-color-text-on-accent);
	}
	.cf-button--primary:not(:disabled):hover {
		background: var(--cf-color-accent-hover);
	}
	.cf-button--primary:not(:disabled):active {
		background: var(--cf-color-accent-active);
	}

	.cf-button--secondary {
		background: var(--cf-color-surface);
		color: var(--cf-color-text);
		border-color: var(--cf-color-border);
	}
	.cf-button--secondary:not(:disabled):hover {
		background: var(--cf-color-surface-raised);
	}

	.cf-button--danger {
		background: var(--cf-color-danger);
		color: var(--cf-color-text-on-accent);
	}

	.cf-button--ghost {
		background: transparent;
		color: var(--cf-color-accent);
	}
	.cf-button--ghost:not(:disabled):hover {
		background: var(--cf-color-surface);
	}

	.cf-button__spinner {
		width: 0.9em;
		height: 0.9em;
		border-radius: 50%;
		border: 2px solid currentColor;
		border-top-color: transparent;
		animation: cf-spin var(--cf-motion-slow) linear infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.cf-button__spinner {
			animation: none;
		}
	}

	@keyframes cf-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
