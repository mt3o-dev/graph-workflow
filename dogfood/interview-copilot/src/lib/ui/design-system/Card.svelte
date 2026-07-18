<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		padding?: 'sm' | 'md' | 'lg';
		elevated?: boolean;
		children: Snippet;
	}

	let { padding = 'md', elevated = false, children }: Props = $props();
</script>

<div class="card card-pad-{padding}" class:elevated>
	{@render children()}
</div>

<style>
	.card {
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.card.elevated {
		box-shadow: var(--shadow-md);
	}

	.card-pad-sm {
		padding: var(--space-3);
	}

	.card-pad-md {
		padding: var(--space-4);
	}

	.card-pad-lg {
		padding: var(--space-6);
	}
</style>
