<script lang="ts">
	import type { SelectOption } from './types.ts';

	interface Props {
		label?: string;
		value?: string;
		options: SelectOption[];
		id?: string;
		disabled?: boolean;
	}

	let {
		label,
		value = $bindable(''),
		options,
		id = `select-${Math.random().toString(36).slice(2, 9)}`,
		disabled = false
	}: Props = $props();
</script>

<div class="field">
	{#if label}
		<label class="field-label" for={id}>{label}</label>
	{/if}
	<select {id} bind:value {disabled} class="field-select">
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.field-label {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--color-text-muted);
	}

	.field-select {
		font: inherit;
		font-size: var(--text-base);
		color: var(--color-text);
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		padding: var(--space-2) var(--space-3);
	}

	.field-select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
