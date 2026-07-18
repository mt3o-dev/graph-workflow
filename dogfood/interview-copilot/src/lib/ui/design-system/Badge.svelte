<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
		children: Snippet;
	}

	let { tone = 'neutral', children }: Props = $props();
</script>

<span class="badge badge-{tone}">{@render children()}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0.125rem var(--space-2);
		border-radius: var(--radius-full);
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		line-height: var(--leading-tight);
		white-space: nowrap;
	}

	.badge-neutral {
		background: var(--color-bg-sunken);
		color: var(--color-text-muted);
	}

	.badge-brand {
		background: var(--color-brand-subtle);
		color: var(--color-brand-700, var(--color-brand));
	}

	.badge-success {
		background: var(--color-success-subtle);
		color: var(--color-success-600, var(--color-success));
	}

	.badge-warning {
		background: var(--color-warning-subtle);
		color: var(--color-warning-600, var(--color-warning));
	}

	.badge-danger {
		background: var(--color-danger-subtle);
		color: var(--color-danger-600, var(--color-danger));
	}

	.badge-info {
		background: var(--color-info-subtle);
		color: var(--color-info-600, var(--color-info));
	}
</style>
