<script lang="ts">
	interface Props {
		label?: string;
		checked?: boolean;
		disabled?: boolean;
		id?: string;
		onchange?: (checked: boolean) => void;
	}

	let {
		label,
		checked = $bindable(false),
		disabled = false,
		id = `toggle-${Math.random().toString(36).slice(2, 9)}`,
		onchange
	}: Props = $props();

	function toggle(): void {
		if (disabled) return;
		checked = !checked;
		onchange?.(checked);
	}
</script>

<label class="toggle-row" for={id}>
	<button
		{id}
		type="button"
		role="switch"
		aria-checked={checked}
		aria-label={label ?? 'Toggle'}
		class="toggle"
		class:on={checked}
		{disabled}
		onclick={toggle}
	>
		<span class="toggle-thumb"></span>
	</button>
	{#if label}
		<span class="toggle-label">{label}</span>
	{/if}
</label>

<style>
	.toggle-row {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
	}

	.toggle {
		position: relative;
		width: 2.25rem;
		height: 1.25rem;
		border-radius: var(--radius-full);
		background: var(--color-border-strong);
		border: none;
		padding: 0;
		cursor: pointer;
		transition: background-color var(--duration-base) var(--ease-standard);
	}

	.toggle.on {
		background: var(--color-brand);
	}

	.toggle:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-thumb {
		position: absolute;
		top: 0.1875rem;
		left: 0.1875rem;
		width: 0.875rem;
		height: 0.875rem;
		border-radius: var(--radius-full);
		background: var(--color-neutral-0);
		transition: transform var(--duration-base) var(--ease-standard);
	}

	.toggle.on .toggle-thumb {
		transform: translateX(1rem);
	}

	.toggle-label {
		font-size: var(--text-sm);
		color: var(--color-text);
	}
</style>
