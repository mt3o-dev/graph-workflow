<script lang="ts">
	import type { AmountSign } from './types';

	/**
	 * Renders a preformatted amount string. Takes the ALREADY locale-formatted
	 * display string in (produced by P2's i18n `format.ts` Intl money
	 * formatter over the P3 bigint-minor-units-as-decimal-string boundary,
	 * [node:f36237e4]) — no Intl call lives in this component. Numbers stay
	 * sober/high-contrast regardless of theme ([dec:12]).
	 */
	interface Props {
		/** Preformatted display string, e.g. "1 234,56 zł" or "-$12.00". */
		value: string;
		sign?: AmountSign;
	}

	let { value, sign = 'neutral' }: Props = $props();
</script>

<span class="cf-amount cf-amount--{sign}" data-testid="amount-text">
	{value}
</span>

<style>
	.cf-amount {
		font-family: var(--cf-font-data);
		font-variant-numeric: var(--cf-font-variant-numeric);
		font-feature-settings: 'tnum' 1;
		color: var(--cf-color-data-text);
	}

	.cf-amount--positive {
		color: var(--cf-color-data-positive);
	}

	.cf-amount--negative {
		color: var(--cf-color-data-negative);
	}
</style>
