<!--
	Thin route wrapper — real markup in `src/lib/ui/screens/ImportScreen.svelte`.
-->
<script lang="ts">
	import type { PageData, ActionData } from './$types.js';
	import ImportScreen from '$lib/ui/screens/ImportScreen.svelte';

	let { data, form }: { data: PageData; form?: ActionData } = $props();
</script>

<ImportScreen
	locale={data.locale}
	enabledParserIds={data.importScreen.enabledParserIds}
	result={form?.result}
	error={Boolean(form?.error)}
/>
