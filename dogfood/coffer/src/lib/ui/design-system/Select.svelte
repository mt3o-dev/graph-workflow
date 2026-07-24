<script lang="ts">
	import type { Size } from './types';

	export interface SelectOption {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		id: string;
		value?: string;
		options: SelectOption[];
		size?: Size;
		disabled?: boolean;
		invalid?: boolean;
		'aria-label'?: string;
		[key: string]: unknown;
	}

	let {
		id,
		value = $bindable(''),
		options,
		size = 'md',
		disabled = false,
		invalid = false,
		...rest
	}: Props = $props();
</script>

<select
	{id}
	{disabled}
	bind:value
	class="cf-select cf-focus-ring cf-select--{size}"
	class:cf-select--invalid={invalid}
	aria-invalid={invalid || undefined}
	{...rest}
>
	{#each options as option (option.value)}
		<option value={option.value} disabled={option.disabled}>{option.label}</option>
	{/each}
</select>

<style>
	.cf-select {
		font-family: var(--cf-font-ui);
		background: var(--cf-color-data-bg);
		color: var(--cf-color-data-text);
		border: 1px solid var(--cf-color-border);
		border-radius: var(--cf-radius-sm);
		width: 100%;
	}

	.cf-select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.cf-select--sm {
		font-size: var(--cf-font-size-sm);
		padding: var(--cf-space-1) var(--cf-space-2);
	}
	.cf-select--md {
		font-size: var(--cf-font-size-md);
		padding: var(--cf-space-2) var(--cf-space-3);
	}
	.cf-select--lg {
		font-size: var(--cf-font-size-lg);
		padding: var(--cf-space-3) var(--cf-space-4);
	}

	.cf-select--invalid {
		border-color: var(--cf-color-danger);
	}
</style>
