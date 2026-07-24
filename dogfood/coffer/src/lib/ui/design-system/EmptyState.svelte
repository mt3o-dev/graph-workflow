<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** i18n'd heading (caller-supplied — no strings live here). */
		title: string;
		description?: string;
		icon?: Snippet;
		action?: Snippet;
	}

	let { title, description, icon, action }: Props = $props();
</script>

<div class="cf-empty-state" role="status">
	{#if icon}
		<div class="cf-empty-state__icon" aria-hidden="true">
			{@render icon()}
		</div>
	{/if}
	<p class="cf-empty-state__title">{title}</p>
	{#if description}
		<p class="cf-empty-state__description">{description}</p>
	{/if}
	{#if action}
		<div class="cf-empty-state__action">
			{@render action()}
		</div>
	{/if}
</div>

<style>
	.cf-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--cf-space-2);
		padding: var(--cf-space-7) var(--cf-space-4);
		color: var(--cf-color-text-muted);
	}

	.cf-empty-state__icon {
		font-size: var(--cf-font-size-2xl);
		opacity: 0.7;
	}

	.cf-empty-state__title {
		font-family: var(--cf-font-display);
		font-size: var(--cf-font-size-lg);
		color: var(--cf-color-text);
		margin: 0;
	}

	.cf-empty-state__description {
		font-size: var(--cf-font-size-sm);
		margin: 0;
		max-width: 32rem;
	}

	.cf-empty-state__action {
		margin-top: var(--cf-space-3);
	}
</style>
