<!--
	Hand-rolled SVG cashflow chart (income/outcome/net over time). Renders the
	P3 `SeriesDto[]` DTOs directly — no data shaping here ([dec:9]).

	Tripwire decision ([node:167451f0]): layerchart 2.0.2 is installed but was
	NOT wired here — its runes-era Svelte 5 mounting story is unverified
	against this project's jsdom component-test substrate within this phase's
	time-box, and the plan explicitly permits (P4 risk note) dropping straight
	to a hand-rolled SVG chart over the SAME DTOs on that tripwire. Recorded
	honestly rather than risking an unverified dependency at the join phase;
	swapping in layerchart later is local to this file (same props in/out).
-->
<script lang="ts">
	import type { SeriesDto } from '$lib/server/ui/dto.js';
	import { formatMoney, formatDate } from '$lib/i18n/format.js';
	import type { Locale } from '$lib/i18n/t.js';

	interface Props {
		series: SeriesDto[];
		currency: string;
		locale: Locale;
	}

	let { series, currency, locale }: Props = $props();

	const WIDTH = 640;
	const HEIGHT = 220;
	const PAD = 32;

	const buckets = $derived([...new Set(series.flatMap((s) => s.points.map((p) => p.bucket)))].sort());

	const values = $derived(series.flatMap((s) => s.points.map((p) => Number(p.value))));
	const minValue = $derived(Math.min(0, ...values, 0));
	const maxValue = $derived(Math.max(0, ...values, 1));

	function x(bucket: string): number {
		const index = buckets.indexOf(bucket);
		const count = Math.max(buckets.length - 1, 1);
		return PAD + (index / count) * (WIDTH - PAD * 2);
	}

	function y(value: number): number {
		const range = maxValue - minValue || 1;
		return HEIGHT - PAD - ((value - minValue) / range) * (HEIGHT - PAD * 2);
	}

	function pathFor(s: SeriesDto): string {
		return s.points
			.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.bucket).toFixed(1)} ${y(Number(p.value)).toFixed(1)}`)
			.join(' ');
	}

	const SERIES_COLORS: Record<string, string> = {
		income: 'var(--cf-color-data-positive)',
		outcome: 'var(--cf-color-data-negative)',
		net: 'var(--cf-color-chart-1)'
	};
</script>

<figure class="cf-cashflow-chart" data-testid="cashflow-chart">
	<svg viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label={currency} data-testid="cashflow-chart-svg">
		<line x1={PAD} y1={y(0)} x2={WIDTH - PAD} y2={y(0)} class="cf-cashflow-chart__axis" />
		{#each series as s (s.id)}
			<path
				d={pathFor(s)}
				class="cf-cashflow-chart__line"
				style:stroke={SERIES_COLORS[s.id] ?? 'var(--cf-color-chart-2)'}
				data-testid="cashflow-series"
				data-series-id={s.id}
			/>
		{/each}
	</svg>
	<figcaption class="cf-cashflow-chart__legend">
		{#each series as s (s.id)}
			{@const last = s.points.at(-1)}
			<span class="cf-cashflow-chart__legend-item" style:color={SERIES_COLORS[s.id] ?? 'var(--cf-color-chart-2)'}>
				{s.label}: {last ? formatMoney(last.value, currency, locale) : formatMoney('0', currency, locale)}
			</span>
		{/each}
		{#if buckets.length > 0}
			<span class="cf-cashflow-chart__range">
				{formatDate(buckets[0], locale)} – {formatDate(buckets.at(-1)!, locale)}
			</span>
		{/if}
	</figcaption>
</figure>

<style>
	.cf-cashflow-chart {
		margin: 0;
	}

	svg {
		width: 100%;
		height: auto;
	}

	.cf-cashflow-chart__axis {
		stroke: var(--cf-color-data-grid);
		stroke-width: 1;
	}

	.cf-cashflow-chart__line {
		fill: none;
		stroke-width: 2;
	}

	.cf-cashflow-chart__legend {
		display: flex;
		gap: var(--cf-space-4);
		flex-wrap: wrap;
		font-size: var(--cf-font-size-sm);
		font-variant-numeric: var(--cf-font-variant-numeric);
	}

	.cf-cashflow-chart__range {
		color: var(--cf-color-text-muted);
		font-size: var(--cf-font-size-xs);
	}
</style>
