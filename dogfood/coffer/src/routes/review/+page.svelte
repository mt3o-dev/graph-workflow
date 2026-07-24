<!--
	Thin route wrapper — real markup in `src/lib/ui/screens/ReviewScreen.svelte`.
-->
<script lang="ts">
	import type { PageData, ActionData } from './$types.js';
	import ReviewScreen from '$lib/ui/screens/ReviewScreen.svelte';

	let { data, form }: { data: PageData; form?: ActionData } = $props();

	const activeSuggestions = $derived(
		form && 'suggested' in form && form.suggested ? form.suggested : undefined
	);
</script>

<ReviewScreen locale={data.locale} queue={data.queue} groups={data.groups} {activeSuggestions} />
