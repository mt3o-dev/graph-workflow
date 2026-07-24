<script lang="ts">
	import type { AttributionMode } from './types';

	/**
	 * Always-visible attribution-mode chip for group charts ([node:167451f0],
	 * dec:8: "the UI always labels which mode a chart uses"). `mode` drives
	 * styling/data-testid only; the displayed text is caller-supplied i18n.
	 */
	interface Props {
		mode: AttributionMode;
		/** i18n'd text, e.g. "Overlap" / "Nakładanie" or "Partition" / "Podział". */
		label: string;
	}

	let { mode, label }: Props = $props();
</script>

<span class="cf-mode-label cf-mode-label--{mode}" data-testid="mode-label" data-mode={mode}>
	{label}
</span>

<style>
	.cf-mode-label {
		display: inline-flex;
		align-items: center;
		font-family: var(--cf-font-ui);
		font-size: var(--cf-font-size-xs);
		font-weight: var(--cf-font-weight-bold);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: var(--cf-space-1) var(--cf-space-2);
		border-radius: var(--cf-radius-sm);
		border: 1px solid currentColor;
	}

	.cf-mode-label--overlap {
		color: var(--cf-color-info);
	}

	.cf-mode-label--partition {
		color: var(--cf-color-accent);
	}
</style>
