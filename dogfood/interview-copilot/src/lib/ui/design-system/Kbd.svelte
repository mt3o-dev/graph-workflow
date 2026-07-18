<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<kbd class="kbd">{@render children()}</kbd>

<style>
	.kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		padding: 0.0625rem var(--space-1);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--color-text-muted);
		background: var(--color-bg-sunken);
		border: 1px solid var(--color-border-strong);
		border-bottom-width: 2px;
		border-radius: var(--radius-sm);
	}
</style>
