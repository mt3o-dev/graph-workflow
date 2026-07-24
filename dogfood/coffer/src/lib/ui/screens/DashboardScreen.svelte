<!--
	Dashboard screen ("The Treasury") — coffer-ui-i18n P4. Renders the P3
	`DashboardDataDto` (cashflow + optional byGroup `SeriesSetDto[]`) per
	currency, granularity/attribution controls, and an empty state when no
	transactions exist yet. No data shaping here — DTOs arrive pre-computed
	([dec:9]).
-->
<script lang="ts">
	import type { SeriesSetDto } from '$lib/server/ui/dto.js';
	import type { Granularity, AttributionMode } from '$lib/core/analytics/model.js';
	import type { RollupVariant } from '$lib/core/analytics/by-group.js';
	import type { Locale } from '$lib/i18n/t.js';
	import { t } from '$lib/i18n/t.js';
	import Card from '../design-system/Card.svelte';
	import Select from '../design-system/Select.svelte';
	import EmptyState from '../design-system/EmptyState.svelte';
	import CashflowChart from './charts/CashflowChart.svelte';
	import ByGroupChart from './charts/ByGroupChart.svelte';

	interface Props {
		locale: Locale;
		cashflow: SeriesSetDto[];
		byGroup?: SeriesSetDto[];
		granularity: Granularity;
		mode: AttributionMode;
		variant: RollupVariant;
		onGranularityChange: (value: Granularity) => void;
		onModeChange: (value: AttributionMode) => void;
		onVariantChange: (value: RollupVariant) => void;
	}

	let { locale, cashflow, byGroup, granularity, mode, variant, onGranularityChange, onModeChange, onVariantChange }: Props =
		$props();

	const hasData = $derived(cashflow.some((set) => set.series.some((s) => s.points.length > 0)));

	const granularityOptions = $derived(
		(['day', 'week', 'month'] as const).map((g) => ({ value: g, label: t(locale, `dashboard.granularity.${g}`) }))
	);
	const modeOptions = $derived(
		(['overlap', 'partition'] as const).map((m) => ({ value: m, label: t(locale, `dashboard.attributionMode.${m}`) }))
	);
	const variantOptions = $derived(
		(['self', 'rollup'] as const).map((v) => ({ value: v, label: t(locale, `dashboard.variant.${v}`) }))
	);

	let granularityChoice = $state(granularity);
	let modeChoice = $state(mode);
	let variantChoice = $state(variant);
</script>

<div class="cf-dashboard" data-testid="dashboard-screen">
	<header>
		<h1>{t(locale, 'dashboard.title')}</h1>
		<p>{t(locale, 'dashboard.subtitle')}</p>
	</header>

	{#if !hasData}
		<EmptyState title={t(locale, 'dashboard.emptyState')} />
	{:else}
		<Card frame="plain">
			<div class="cf-dashboard__controls">
				<label for="granularity-select">{t(locale, 'dashboard.granularityLabel')}</label>
				<Select
					id="granularity-select"
					options={granularityOptions}
					bind:value={granularityChoice}
					onchange={() => onGranularityChange(granularityChoice)}
				/>
			</div>
			<h2>{t(locale, 'dashboard.cashflowHeading')}</h2>
			{#each cashflow as set (set.currency)}
				<section data-testid="cashflow-currency-section">
					<h3>{t(locale, 'dashboard.currencyHeading', { currency: set.currency })}</h3>
					<CashflowChart series={[...set.series]} currency={set.currency} {locale} />
				</section>
			{/each}
		</Card>

		{#if byGroup}
			<Card frame="plain">
				<div class="cf-dashboard__controls">
					<label for="mode-select">{t(locale, 'dashboard.attributionModeLabel')}</label>
					<Select id="mode-select" options={modeOptions} bind:value={modeChoice} onchange={() => onModeChange(modeChoice)} />
					<label for="variant-select">{t(locale, 'dashboard.variantLabel')}</label>
					<Select
						id="variant-select"
						options={variantOptions}
						bind:value={variantChoice}
						onchange={() => onVariantChange(variantChoice)}
					/>
				</div>
				<h2>{t(locale, 'dashboard.byGroupHeading')}</h2>
				{#each byGroup as set (set.currency)}
					<section data-testid="by-group-currency-section">
						<h3>{t(locale, 'dashboard.currencyHeading', { currency: set.currency })}</h3>
						<ByGroupChart
							series={[...set.series]}
							currency={set.currency}
							{locale}
							modeLabelText={t(locale, 'dashboard.modeLabel', { mode: t(locale, `dashboard.attributionMode.${set.series[0]?.mode ?? 'overlap'}`) })}
							unclassifiedLabel={t(locale, 'dashboard.unclassifiedSeriesLabel')}
						/>
					</section>
				{/each}
			</Card>
		{/if}
	{/if}
</div>

<style>
	.cf-dashboard {
		display: flex;
		flex-direction: column;
		gap: var(--cf-space-5);
	}

	.cf-dashboard__controls {
		display: flex;
		align-items: center;
		gap: var(--cf-space-3);
		margin-bottom: var(--cf-space-4);
	}
</style>
