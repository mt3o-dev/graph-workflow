<script lang="ts">
	import type { Snippet } from 'svelte';

	type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

	interface Props {
		tone?: BadgeTone;
		children: Snippet;
		[key: string]: unknown;
	}

	let { tone = 'neutral', children, ...rest }: Props = $props();
</script>

<span class="cf-badge cf-badge--{tone}" {...rest}>
	{@render children()}
</span>

<style>
	.cf-badge {
		display: inline-flex;
		align-items: center;
		gap: var(--cf-space-1);
		font-family: var(--cf-font-ui);
		font-size: var(--cf-font-size-xs);
		font-weight: var(--cf-font-weight-medium);
		line-height: var(--cf-line-height-tight);
		padding: var(--cf-space-1) var(--cf-space-2);
		border-radius: var(--cf-radius-full);
		border: 1px solid transparent;
	}

	.cf-badge--neutral {
		background: var(--cf-color-surface-raised);
		color: var(--cf-color-text-muted);
		border-color: var(--cf-color-border-subtle);
	}
	.cf-badge--success {
		background: var(--cf-color-surface-raised);
		color: var(--cf-color-success);
		border-color: var(--cf-color-success);
	}
	.cf-badge--danger {
		background: var(--cf-color-surface-raised);
		color: var(--cf-color-danger);
		border-color: var(--cf-color-danger);
	}
	.cf-badge--warning {
		background: var(--cf-color-surface-raised);
		color: var(--cf-color-warning);
		border-color: var(--cf-color-warning);
	}
	.cf-badge--info {
		background: var(--cf-color-surface-raised);
		color: var(--cf-color-info);
		border-color: var(--cf-color-info);
	}
</style>
