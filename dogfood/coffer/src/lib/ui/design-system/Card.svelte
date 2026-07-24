<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** 'ornamental' adds decorative chrome framing (aria-hidden); never
		 * applied to a card that renders numeric/data content directly
		 * ([dec:12] — theme is chrome, not data legibility). */
		frame?: 'plain' | 'ornamental';
		padded?: boolean;
		children: Snippet;
		[key: string]: unknown;
	}

	let { frame = 'plain', padded = true, children, ...rest }: Props = $props();
</script>

<div class="cf-card cf-card--{frame}" class:cf-card--padded={padded} {...rest}>
	{#if frame === 'ornamental'}
		<span class="cf-card__corner cf-card__corner--tl" aria-hidden="true"></span>
		<span class="cf-card__corner cf-card__corner--tr" aria-hidden="true"></span>
		<span class="cf-card__corner cf-card__corner--bl" aria-hidden="true"></span>
		<span class="cf-card__corner cf-card__corner--br" aria-hidden="true"></span>
	{/if}
	<div class="cf-card__content">
		{@render children()}
	</div>
</div>

<style>
	.cf-card {
		position: relative;
		background: var(--cf-color-surface);
		border: 1px solid var(--cf-color-border-subtle);
		border-radius: var(--cf-radius-lg);
		box-shadow: var(--cf-shadow-sm);
	}

	.cf-card--padded .cf-card__content {
		padding: var(--cf-space-5);
	}

	.cf-card--ornamental {
		border-color: var(--cf-color-border);
		box-shadow: var(--cf-shadow-ornament);
	}

	.cf-card__corner {
		position: absolute;
		width: 1.25rem;
		height: 1.25rem;
		pointer-events: none;
		border: 2px solid var(--cf-color-accent);
		opacity: 0.6;
	}
	.cf-card__corner--tl {
		top: -1px;
		left: -1px;
		border-right: none;
		border-bottom: none;
		border-top-left-radius: var(--cf-radius-lg);
	}
	.cf-card__corner--tr {
		top: -1px;
		right: -1px;
		border-left: none;
		border-bottom: none;
		border-top-right-radius: var(--cf-radius-lg);
	}
	.cf-card__corner--bl {
		bottom: -1px;
		left: -1px;
		border-right: none;
		border-top: none;
		border-bottom-left-radius: var(--cf-radius-lg);
	}
	.cf-card__corner--br {
		bottom: -1px;
		right: -1px;
		border-left: none;
		border-top: none;
		border-bottom-right-radius: var(--cf-radius-lg);
	}
</style>
