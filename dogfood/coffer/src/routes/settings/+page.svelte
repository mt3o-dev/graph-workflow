<!--
	Thin route wrapper — real markup in `src/lib/ui/screens/SettingsScreen.svelte`.
-->
<script lang="ts">
	import type { PageData } from './$types.js';
	import SettingsScreen from '$lib/ui/screens/SettingsScreen.svelte';

	let { data }: { data: PageData } = $props();
</script>

<SettingsScreen locale={data.locale} groups={data.groups} rules={data.rules} />
