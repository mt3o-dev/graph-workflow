<!--
	Hand-rolled SVG by-group bar chart ([node:167451f0] tripwire — see
	`CashflowChart.svelte`'s header note for the layerchart deferral). The
	`__unclassified__` series ([node:0b08fbef]) renders in its OWN muted/
	hatched bar off the group palette, with its own caller-supplied i18n
	label, and `ModeLabel` is ALWAYS visible regardless of series content.
-->
<script lang="ts">
	import type { SeriesDto } from '$lib/server/ui/dto.js';
	import { UNCLASSIFIED_GROUP_ID } from '$lib/core/analytics/series.js';
	import { formatMoney } from '$lib/i18n/format.js';
	import type { Locale } from '$lib/i18n/t.js';
	import ModeLabel from '../../design-system/ModeLabel.svelte';
	import AmountText from '../../design-system/AmountText.svelte';

	interface Props {
		series: SeriesDto[];
		currency: string;
		locale: Locale;
		modeLabelText: string;
		unclassifiedLabel: string;
	}

	let { series, currency, locale, modeLabelText, unclassifiedLabel }: Props = $props();

	const mode = $derived(series[0]?.mode ?? 'overlap');
	const totals = $derived(series.map((s) => Number(s.points[0]?.value ?? 0n)));
	const maxAbs = $derived(Math.max(1, ...totals.map(Math.abs)));

	function barWidthPercent(value: number): number {
		return Math.max(2, (Math.abs(value) / maxAbs) * 100);
	}
</script>

<section class="cf-bygroup-chart" data-testid="by-group-chart">
	<ModeLabel {mode} label={modeLabelText} />
	<ul class="cf-bygroup-chart__bars">
		{#each series as s (s.id)}
			{@const value = Number(s.points[0]?.value ?? 0n)}
			{@const isUnclassified = s.id === UNCLASSIFIED_GROUP_ID}
			<li
				class="cf-bygroup-chart__row"
				class:cf-bygroup-chart__row--unclassified={isUnclassified}
				data-testid={isUnclassified ? 'by-group-unclassified' : 'by-group-row'}
				data-group-id={s.id}
			>
				<span class="cf-bygroup-chart__label">{isUnclassified ? unclassifiedLabel : s.label}</span>
				<span class="cf-bygroup-chart__bar-track">
					<span
						class="cf-bygroup-chart__bar"
						class:cf-bygroup-chart__bar--unclassified={isUnclassified}
						style:width="{barWidthPercent(value)}%"
					></span>
				</span>
				<AmountText value={formatMoney(s.points[0]?.value ?? '0', currency, locale)} sign={value < 0 ? 'negative' : 'positive'} />
			</li>
		{/each}
	</ul>
</section>

<style>
	.cf-bygroup-chart__bars {
		list-style: none;
		margin: var(--cf-space-3) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--cf-space-2);
	}

	.cf-bygroup-chart__row {
		display: grid;
		grid-template-columns: 8rem 1fr auto;
		align-items: center;
		gap: var(--cf-space-3);
	}

	.cf-bygroup-chart__label {
		font-size: var(--cf-font-size-sm);
	}

	.cf-bygroup-chart__bar-track {
		background: var(--cf-color-data-grid);
		border-radius: var(--cf-radius-sm);
		overflow: hidden;
		height: 0.9rem;
	}

	.cf-bygroup-chart__bar {
		display: block;
		height: 100%;
		background: var(--cf-color-chart-1);
	}

	.cf-bygroup-chart__bar--unclassified {
		background: repeating-linear-gradient(
			45deg,
			var(--cf-color-data-unclassified),
			var(--cf-color-data-unclassified) 4px,
			var(--cf-color-data-unclassified-pattern) 4px,
			var(--cf-color-data-unclassified-pattern) 8px
		);
	}

	.cf-bygroup-chart__row--unclassified .cf-bygroup-chart__label {
		font-style: italic;
		color: var(--cf-color-text-muted);
	}
</style>
