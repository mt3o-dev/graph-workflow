<!--
	App chrome ([node:2e5f97e2] fantasy nav names, [node:d8caed23] logout).
	`data.locale` is resolved by `+layout.server.ts`. Theme cookie SSR-stamping
	on `<html>` is P6's integration job (plan.md P6); `ThemeToggle` still works
	standalone client-side here.
-->
<script lang="ts">
	import '$lib/ui/design-system/tokens.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types.js';
	import { t } from '$lib/i18n/t.js';
	import { LOCALE_COOKIE_NAME, LOCALE_COOKIE_MAX_AGE_SECONDS, SUPPORTED_LOCALES } from '$lib/i18n/locale.js';
	import ThemeToggle from '$lib/ui/design-system/ThemeToggle.svelte';
	import Select from '$lib/ui/design-system/Select.svelte';
	import Button from '$lib/ui/design-system/Button.svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const locale = $derived(data.locale);
	let localeChoice = $state(data.locale);

	function onLocaleChange() {
		if (typeof document !== 'undefined') {
			document.cookie = `${LOCALE_COOKIE_NAME}=${localeChoice}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
		}
		if (typeof window !== 'undefined') {
			window.location.reload();
		}
	}

	const localeOptions = SUPPORTED_LOCALES.map((code) => ({ value: code, label: code.toUpperCase() }));
</script>

<div class="cf-app">
	<header class="cf-app__header">
		<a class="cf-app__brand" href="/">{t(locale, 'brand.name')}</a>
		<nav class="cf-app__nav" aria-label={t(locale, 'nav.dashboard')}>
			<a href="/">{t(locale, 'nav.dashboard')}</a>
			<a href="/import">{t(locale, 'nav.import')}</a>
			<a href="/review">{t(locale, 'nav.review')}</a>
			<a href="/settings">{t(locale, 'nav.settings')}</a>
		</nav>
		<div class="cf-app__controls">
			<Select
				id="locale-switcher"
				options={localeOptions}
				bind:value={localeChoice}
				onchange={onLocaleChange}
				aria-label={t(locale, 'chrome.localeSelectLabel')}
			/>
			<ThemeToggle label={t(locale, 'chrome.themeToggleLabel')} />
			<form method="POST" action="/logout">
				<Button type="submit" variant="ghost">{t(locale, 'nav.logout')}</Button>
			</form>
		</div>
	</header>
	<main class="cf-app__main">
		{@render children()}
	</main>
</div>

<style>
	.cf-app {
		min-height: 100vh;
		background: var(--cf-color-bg);
		color: var(--cf-color-text);
		font-family: var(--cf-font-ui);
	}

	.cf-app__header {
		display: flex;
		align-items: center;
		gap: var(--cf-space-5);
		padding: var(--cf-space-3) var(--cf-space-5);
		border-bottom: 1px solid var(--cf-color-border-subtle);
		background: var(--cf-color-surface);
	}

	.cf-app__brand {
		font-family: var(--cf-font-display);
		font-size: var(--cf-font-size-lg);
		color: var(--cf-color-text);
		text-decoration: none;
	}

	.cf-app__nav {
		display: flex;
		gap: var(--cf-space-4);
		flex: 1;
	}

	.cf-app__nav a {
		color: var(--cf-color-text-muted);
		text-decoration: none;
		font-weight: var(--cf-font-weight-medium);
	}

	.cf-app__nav a:hover {
		color: var(--cf-color-accent);
	}

	.cf-app__controls {
		display: flex;
		align-items: center;
		gap: var(--cf-space-3);
	}

	.cf-app__main {
		padding: var(--cf-space-5);
	}
</style>
