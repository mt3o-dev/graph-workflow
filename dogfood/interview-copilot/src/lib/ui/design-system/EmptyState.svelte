<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		icon?: string;
		title: string;
		description?: string;
		actions?: Snippet;
	}

	let { icon = '—', title, description, actions }: Props = $props();
</script>

<div class="empty-state">
	<div class="empty-icon" aria-hidden="true">{icon}</div>
	<p class="empty-title">{title}</p>
	{#if description}
		<p class="empty-description">{description}</p>
	{/if}
	{#if actions}
		<div class="empty-actions">{@render actions()}</div>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-2);
		padding: var(--space-8) var(--space-4);
		color: var(--color-text-muted);
	}

	.empty-icon {
		font-size: var(--text-2xl);
		color: var(--color-text-faint);
	}

	.empty-title {
		margin: 0;
		font-size: var(--text-md);
		font-weight: var(--weight-semibold);
		color: var(--color-text);
	}

	.empty-description {
		margin: 0;
		max-width: 32rem;
		font-size: var(--text-sm);
	}

	.empty-actions {
		margin-top: var(--space-2);
	}
</style>
