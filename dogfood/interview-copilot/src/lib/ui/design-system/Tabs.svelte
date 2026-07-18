<script lang="ts">
	import type { TabItem } from './types.ts';

	interface Props {
		tabs: TabItem[];
		active?: string;
		onchange?: (id: string) => void;
	}

	let { tabs, active = $bindable(tabs[0]?.id ?? ''), onchange }: Props = $props();

	function select(id: string): void {
		active = id;
		onchange?.(id);
	}

	function onKeydown(event: KeyboardEvent, index: number): void {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		event.preventDefault();
		const delta = event.key === 'ArrowRight' ? 1 : -1;
		const next = tabs[(index + delta + tabs.length) % tabs.length];
		if (next) select(next.id);
	}
</script>

<div class="tabs" role="tablist">
	{#each tabs as tab, index (tab.id)}
		<button
			type="button"
			role="tab"
			id="tab-{tab.id}"
			aria-controls="tabpanel-{tab.id}"
			aria-selected={active === tab.id}
			tabindex={active === tab.id ? 0 : -1}
			class="tab"
			class:active={active === tab.id}
			onclick={() => select(tab.id)}
			onkeydown={(e) => onKeydown(e, index)}
		>
			{tab.label}
		</button>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		gap: var(--space-1);
		border-bottom: 1px solid var(--color-border);
	}

	.tab {
		font: inherit;
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--color-text-muted);
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		padding: var(--space-2) var(--space-3);
		cursor: pointer;
		transition:
			color var(--duration-base) var(--ease-standard),
			border-color var(--duration-base) var(--ease-standard);
	}

	.tab:hover {
		color: var(--color-text);
	}

	.tab.active {
		color: var(--color-brand);
		border-bottom-color: var(--color-brand);
	}
</style>
