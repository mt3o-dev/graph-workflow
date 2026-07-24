<!--
	Thin route wrapper (P4 restyle, [node:d8caed23]) — the real markup lives in
	`src/lib/ui/screens/LoginScreen.svelte` (covered by the jsdom component
	vitest project; `src/routes/**` is not). Locale is resolved by the root
	`+layout.server.ts` and merged into `data` down the layout tree.
-->
<script lang="ts">
	import type { PageData, ActionData } from './$types.js';
	import LoginScreen from '$lib/ui/screens/LoginScreen.svelte';

	let { data, form }: { data: PageData; form?: ActionData } = $props();
</script>

<LoginScreen locale={data.locale} error={Boolean(form?.error)} />
