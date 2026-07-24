<script lang="ts">
	import type { Size } from './types';

	interface Props {
		size?: Size;
		/** i18n'd accessible label, e.g. "Loading" / "Wczytywanie" (caller-supplied). */
		label: string;
	}

	let { size = 'md', label }: Props = $props();
</script>

<span class="cf-spinner cf-spinner--{size}" role="status" aria-label={label}></span>

<style>
	.cf-spinner {
		display: inline-block;
		border-radius: 50%;
		border: 2px solid var(--cf-color-border-subtle);
		border-top-color: var(--cf-color-accent);
		animation: cf-spinner-spin var(--cf-motion-slow) linear infinite;
	}

	.cf-spinner--sm {
		width: 1rem;
		height: 1rem;
	}
	.cf-spinner--md {
		width: 1.5rem;
		height: 1.5rem;
	}
	.cf-spinner--lg {
		width: 2.5rem;
		height: 2.5rem;
		border-width: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.cf-spinner {
			animation-duration: 1.5s;
		}
	}

	@keyframes cf-spinner-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
