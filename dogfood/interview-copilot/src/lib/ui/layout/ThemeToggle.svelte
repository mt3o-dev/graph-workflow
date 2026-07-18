<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '../design-system/Button.svelte';

	type ThemePreference = 'light' | 'dark' | 'system';

	const STORAGE_KEY = 'ic-theme';

	let preference = $state<ThemePreference>('system');

	onMount(() => {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (stored === 'light' || stored === 'dark' || stored === 'system') {
			preference = stored;
		}
		apply(preference);
	});

	function apply(next: ThemePreference): void {
		if (next === 'system') {
			document.documentElement.removeAttribute('data-theme');
		} else {
			document.documentElement.setAttribute('data-theme', next);
		}
	}

	function cycle(): void {
		const order: ThemePreference[] = ['system', 'light', 'dark'];
		preference = order[(order.indexOf(preference) + 1) % order.length]!;
		window.localStorage.setItem(STORAGE_KEY, preference);
		apply(preference);
	}

	const icon = $derived(preference === 'light' ? '☀' : preference === 'dark' ? '☾' : '◐');
	const label = $derived(`Theme: ${preference}. Click to change.`);
</script>

<Button variant="ghost" size="sm" onclick={cycle} aria-label={label}>
	<span aria-hidden="true">{icon}</span>
	{preference}
</Button>
