<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		subtitle?: string;
		actions?: Snippet;
		children: Snippet;
	}

	let { title, subtitle, actions, children }: Props = $props();
</script>

<section class="panel">
	{#if title || actions}
		<header class="panel-header">
			<div class="panel-heading">
				{#if title}
					<h2 class="panel-title">{title}</h2>
				{/if}
				{#if subtitle}
					<p class="panel-subtitle">{subtitle}</p>
				{/if}
			</div>
			{#if actions}
				<div class="panel-actions">{@render actions()}</div>
			{/if}
		</header>
	{/if}
	<div class="panel-body">
		{@render children()}
	</div>
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		min-height: 0;
	}

	.panel-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-bg-sunken);
	}

	.panel-title {
		margin: 0;
		font-size: var(--text-md);
		font-weight: var(--weight-semibold);
	}

	.panel-subtitle {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--color-text-muted);
	}

	.panel-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	.panel-body {
		padding: var(--space-4);
		overflow: auto;
		min-height: 0;
	}
</style>
