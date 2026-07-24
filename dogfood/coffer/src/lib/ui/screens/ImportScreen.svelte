<!--
	Import screen ("Tally the Takings") — coffer-ui-i18n P4. File-upload form
	(CSV/OFX/PDF-text, routed through `performImport` by the thin
	`+page.server.ts` action) + result panel + enabled-parsers list.
-->
<script lang="ts">
	import type { Locale } from '$lib/i18n/t.js';
	import { t } from '$lib/i18n/t.js';
	import { formatCount } from '$lib/i18n/format.js';
	import Card from '../design-system/Card.svelte';
	import Input from '../design-system/Input.svelte';
	import Button from '../design-system/Button.svelte';
	import Badge from '../design-system/Badge.svelte';

	interface ImportResult {
		batchId: string;
		inserted: number;
		duplicates: number;
	}

	interface Props {
		locale: Locale;
		enabledParserIds: readonly string[];
		result?: ImportResult;
		error?: boolean;
	}

	let { locale, enabledParserIds, result, error = false }: Props = $props();
</script>

<div class="cf-import" data-testid="import-screen">
	<header>
		<h1>{t(locale, 'import.title')}</h1>
		<p>{t(locale, 'import.subtitle')}</p>
	</header>

	<Card frame="ornamental">
		<form method="POST" enctype="multipart/form-data" class="cf-import__form">
			<label for="import-account">{t(locale, 'import.accountLabel')}</label>
			<Input id="import-account" name="sourceAccount" aria-label={t(locale, 'import.accountLabel')} />

			<label for="import-currency">{t(locale, 'import.currencyLabel')}</label>
			<Input id="import-currency" name="defaultCurrency" aria-label={t(locale, 'import.currencyLabel')} />

			<label for="import-file">{t(locale, 'import.fileLabel')}</label>
			<input id="import-file" name="statement" type="file" required />

			<Button type="submit" variant="primary">{t(locale, 'import.uploadButton')}</Button>
		</form>
	</Card>

	{#if result}
		<Card frame="plain" data-testid="import-result">
			<h2>{t(locale, 'import.resultHeading')}</h2>
			<p>{t(locale, 'import.batchLabel', { id: result.batchId })}</p>
			<p>{t(locale, 'import.successCount', { count: result.inserted })}</p>
			<p>{t(locale, 'import.duplicateCount', { count: result.duplicates })}</p>
			<p class="cf-import__result-note">{formatCount(result.inserted + result.duplicates, locale)}</p>
		</Card>
	{:else if error}
		<p role="alert">{t(locale, 'import.genericError')}</p>
	{/if}

	<Card frame="plain">
		<h2>{t(locale, 'import.enabledParsersHeading')}</h2>
		<ul class="cf-import__parsers">
			{#each enabledParserIds as parserId (parserId)}
				<li><Badge tone="info">{parserId}</Badge></li>
			{/each}
		</ul>
	</Card>
</div>

<style>
	.cf-import {
		display: flex;
		flex-direction: column;
		gap: var(--cf-space-4);
	}

	.cf-import__form {
		display: flex;
		flex-direction: column;
		gap: var(--cf-space-2);
		max-width: 24rem;
	}

	.cf-import__parsers {
		list-style: none;
		display: flex;
		gap: var(--cf-space-2);
		padding: 0;
	}

	.cf-import__result-note {
		font-size: var(--cf-font-size-xs);
		color: var(--cf-color-text-muted);
	}
</style>
