<!--
	Login screen (P5 stub restyled by P4, [node:d8caed23]). Design-system
	markup only — the actual POST goes through the real `<form method="POST">`
	the thin `src/routes/login/+page.svelte` wrapper renders around this
	component's markup; kept here so it's covered by the jsdom `component`
	vitest project (routes/** isn't).
-->
<script lang="ts">
	import Card from '../design-system/Card.svelte';
	import Input from '../design-system/Input.svelte';
	import Button from '../design-system/Button.svelte';
	import { t, type Locale } from '$lib/i18n/t.js';

	interface Props {
		locale: Locale;
		/** True when the previous login attempt failed ([node:d8caed23]). */
		error?: boolean;
	}

	let { locale, error = false }: Props = $props();

	let passphrase = $state('');
</script>

<main class="cf-login">
	<Card frame="ornamental">
		<h1>{t(locale, 'auth.loginTitle')}</h1>
		<p>{t(locale, 'auth.loginSubtitle')}</p>

		{#if error}
			<p role="alert" class="cf-login__error">{t(locale, 'auth.loginError')}</p>
		{/if}

		<form method="POST" class="cf-login__form">
			<label for="passphrase">{t(locale, 'auth.passphraseLabel')}</label>
			<Input
				id="passphrase"
				name="passphrase"
				type="password"
				bind:value={passphrase}
				aria-label={t(locale, 'auth.passphraseLabel')}
			/>

			<Button type="submit" variant="primary">{t(locale, 'auth.loginButton')}</Button>
		</form>
	</Card>
</main>

<style>
	.cf-login {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		padding: var(--cf-space-4);
	}

	.cf-login__form {
		display: flex;
		flex-direction: column;
		gap: var(--cf-space-3);
		margin-top: var(--cf-space-4);
	}

	.cf-login__error {
		color: var(--cf-color-danger);
	}
</style>
