<script lang="ts">
	interface Props {
		label?: string;
		value?: string;
		type?: string;
		placeholder?: string;
		error?: string;
		id?: string;
		disabled?: boolean;
	}

	let {
		label,
		value = $bindable(''),
		type = 'text',
		placeholder,
		error,
		id = `input-${Math.random().toString(36).slice(2, 9)}`,
		disabled = false
	}: Props = $props();
</script>

<div class="field">
	{#if label}
		<label class="field-label" for={id}>{label}</label>
	{/if}
	<input
		{id}
		{type}
		{placeholder}
		{disabled}
		bind:value
		class="field-input"
		class:has-error={!!error}
		aria-invalid={!!error}
		aria-describedby={error ? `${id}-error` : undefined}
	/>
	{#if error}
		<p class="field-error" id="{id}-error">{error}</p>
	{/if}
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

	.field-input {
		font: inherit;
		font-size: var(--text-base);
		color: var(--color-text);
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		padding: var(--space-2) var(--space-3);
		transition: border-color var(--duration-base) var(--ease-standard);
	}

	.field-input:hover:not(:disabled) {
		border-color: var(--color-text-faint);
	}

	.field-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.field-input.has-error {
		border-color: var(--color-danger);
	}

	.field-error {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--color-danger);
	}
</style>
