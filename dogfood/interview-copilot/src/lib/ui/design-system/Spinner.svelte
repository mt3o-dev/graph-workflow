<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg';
		label?: string;
	}

	let { size = 'md', label = 'Loading' }: Props = $props();
</script>

<span class="spinner spinner-{size}" role="status" aria-label={label}></span>

<style>
	.spinner {
		display: inline-block;
		border-radius: var(--radius-full);
		border: 2px solid var(--color-border-strong);
		border-top-color: var(--color-brand);
		animation: spin var(--duration-slow) linear infinite;
		animation-duration: 700ms;
	}

	.spinner-sm {
		width: 0.875rem;
		height: 0.875rem;
	}

	.spinner-md {
		width: 1.25rem;
		height: 1.25rem;
	}

	.spinner-lg {
		width: 2rem;
		height: 2rem;
		border-width: 3px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
	}
</style>
