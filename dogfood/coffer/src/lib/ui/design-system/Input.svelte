<script lang="ts">
	import type { Size } from './types';

	interface Props {
		id: string;
		value?: string;
		type?: 'text' | 'email' | 'password' | 'search' | 'number';
		size?: Size;
		disabled?: boolean;
		invalid?: boolean;
		placeholder?: string;
		'aria-label'?: string;
		'aria-describedby'?: string;
		[key: string]: unknown;
	}

	let {
		id,
		value = $bindable(''),
		type = 'text',
		size = 'md',
		disabled = false,
		invalid = false,
		placeholder,
		...rest
	}: Props = $props();
</script>

<input
	{id}
	{type}
	{disabled}
	{placeholder}
	bind:value
	class="cf-input cf-focus-ring cf-input--{size}"
	class:cf-input--invalid={invalid}
	aria-invalid={invalid || undefined}
	{...rest}
/>

<style>
	.cf-input {
		font-family: var(--cf-font-ui);
		background: var(--cf-color-data-bg);
		color: var(--cf-color-data-text);
		border: 1px solid var(--cf-color-border);
		border-radius: var(--cf-radius-sm);
		width: 100%;
		transition:
			border-color var(--cf-motion-fast) var(--cf-motion-ease),
			box-shadow var(--cf-motion-fast) var(--cf-motion-ease);
	}

	.cf-input::placeholder {
		color: var(--cf-color-text-muted);
	}

	.cf-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.cf-input--sm {
		font-size: var(--cf-font-size-sm);
		padding: var(--cf-space-1) var(--cf-space-2);
	}
	.cf-input--md {
		font-size: var(--cf-font-size-md);
		padding: var(--cf-space-2) var(--cf-space-3);
	}
	.cf-input--lg {
		font-size: var(--cf-font-size-lg);
		padding: var(--cf-space-3) var(--cf-space-4);
	}

	.cf-input--invalid {
		border-color: var(--cf-color-danger);
	}
</style>
