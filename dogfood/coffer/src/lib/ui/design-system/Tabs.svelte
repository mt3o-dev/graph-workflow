<script lang="ts">
	import type { Snippet } from 'svelte';

	export interface TabItem {
		id: string;
		label: string;
		content: Snippet;
	}

	interface Props {
		tabs: TabItem[];
		selected?: string;
		/** i18n'd label read by screen readers for the tablist (caller-supplied). */
		'aria-label'?: string;
	}

	let { tabs, selected = $bindable(tabs[0]?.id ?? ''), ...rest }: Props = $props();

	function select(id: string) {
		selected = id;
	}

	function onKeydown(event: KeyboardEvent, index: number) {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		event.preventDefault();
		const delta = event.key === 'ArrowRight' ? 1 : -1;
		const next = (index + delta + tabs.length) % tabs.length;
		select(tabs[next].id);
	}
</script>

<div class="cf-tabs">
	<div class="cf-tabs__list" role="tablist" {...rest}>
		{#each tabs as tab, index (tab.id)}
			<button
				type="button"
				role="tab"
				id="cf-tab-{tab.id}"
				aria-selected={selected === tab.id}
				aria-controls="cf-tabpanel-{tab.id}"
				tabindex={selected === tab.id ? 0 : -1}
				class="cf-tabs__tab cf-focus-ring"
				class:cf-tabs__tab--active={selected === tab.id}
				onclick={() => select(tab.id)}
				onkeydown={(event) => onKeydown(event, index)}
			>
				{tab.label}
			</button>
		{/each}
	</div>
	{#each tabs as tab (tab.id)}
		<div
			role="tabpanel"
			id="cf-tabpanel-{tab.id}"
			aria-labelledby="cf-tab-{tab.id}"
			hidden={selected !== tab.id}
			class="cf-tabs__panel"
		>
			{@render tab.content()}
		</div>
	{/each}
</div>

<style>
	.cf-tabs__list {
		display: flex;
		gap: var(--cf-space-2);
		border-bottom: 1px solid var(--cf-color-border-subtle);
	}

	.cf-tabs__tab {
		font-family: var(--cf-font-ui);
		font-size: var(--cf-font-size-md);
		font-weight: var(--cf-font-weight-medium);
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--cf-color-text-muted);
		padding: var(--cf-space-2) var(--cf-space-3);
		cursor: pointer;
		transition:
			color var(--cf-motion-fast) var(--cf-motion-ease),
			border-color var(--cf-motion-fast) var(--cf-motion-ease);
	}

	.cf-tabs__tab--active {
		color: var(--cf-color-accent);
		border-bottom-color: var(--cf-color-accent);
	}

	.cf-tabs__panel {
		padding-top: var(--cf-space-4);
	}
</style>
