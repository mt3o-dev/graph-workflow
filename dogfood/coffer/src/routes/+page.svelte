<!--
	Thin route wrapper for the dashboard ("The Treasury") — real markup lives
	in `src/lib/ui/screens/DashboardScreen.svelte` (jsdom component vitest
	coverage; `src/routes/**` isn't covered there).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageData } from './$types.js';
	import DashboardScreen from '$lib/ui/screens/DashboardScreen.svelte';
	import type { Granularity, AttributionMode } from '$lib/core/analytics/model.js';
	import type { RollupVariant } from '$lib/core/analytics/by-group.js';

	let { data }: { data: PageData } = $props();

	function withParam(key: string, value: string) {
		const url = new URL(page.url);
		url.searchParams.set(key, value);
		void goto(url, { invalidateAll: true });
	}
</script>

<DashboardScreen
	locale={data.locale}
	cashflow={data.dashboard.cashflow}
	byGroup={data.dashboard.byGroup}
	granularity={data.granularity}
	mode={data.mode}
	variant={data.variant}
	onGranularityChange={(value: Granularity) => withParam('granularity', value)}
	onModeChange={(value: AttributionMode) => withParam('mode', value)}
	onVariantChange={(value: RollupVariant) => withParam('variant', value)}
/>
