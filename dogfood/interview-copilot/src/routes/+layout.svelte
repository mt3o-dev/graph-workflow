<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../lib/ui/design-system/tokens.css';
	import AppNav from '$lib/ui/layout/AppNav.svelte';
	import StatusFooter from '$lib/ui/layout/StatusFooter.svelte';
	import ThemeToggle from '$lib/ui/layout/ThemeToggle.svelte';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Interview Copilot</title>
</svelte:head>

<div class="app-shell">
	<header class="app-header">
		<span class="app-title">Interview Copilot</span>
		<AppNav />
		<ThemeToggle />
	</header>

	<main class="app-main">
		<svelte:boundary onerror={(error) => console.error('[uncaught]', error)}>
			{@render children()}
			{#snippet failed(error, reset)}
				<div class="error-banner" data-testid="uncaught-error-banner" role="alert">
					<p>Something went wrong: {error instanceof Error ? error.message : String(error)}</p>
					<button type="button" onclick={reset}>Retry</button>
				</div>
			{/snippet}
		</svelte:boundary>
	</main>

	<StatusFooter
		sttAdapter={data.sttAdapter}
		embeddingsAdapter={data.embeddingsAdapter}
		answerAdapter={data.answerAdapter}
	/>
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.app-header {
		display: flex;
		align-items: center;
		gap: var(--space-6);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-bg-raised);
	}

	.app-title {
		font-size: var(--text-md);
		font-weight: var(--weight-bold);
		margin-right: auto;
	}

	.app-main {
		flex: 1;
		min-height: 0;
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		background: var(--color-danger-subtle);
		color: var(--color-danger-600, var(--color-danger));
	}
</style>
