<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		/** i18n'd accessible dialog title (caller-supplied). */
		title: string;
		onclose: () => void;
		children: Snippet;
	}

	let { open, title, onclose, children }: Props = $props();

	let dialogEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (open) {
			dialogEl?.focus();
		}
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onclose();
		}
	}

	function onBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onclose();
		}
	}
</script>

<!-- Native <dialog>.showModal() is intentionally avoided: jsdom (this
     project's component-test environment, [node:...] jsdom-only substrate)
     does not implement it, and a manually-managed role="dialog" overlay
     keeps the component testable end to end. -->
{#if open}
	<div class="cf-dialog__backdrop" onclick={onBackdropClick} role="presentation">
		<div
			bind:this={dialogEl}
			class="cf-dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="cf-dialog-title"
			tabindex="-1"
			onkeydown={onKeydown}
		>
			<h2 id="cf-dialog-title" class="cf-dialog__title">{title}</h2>
			<div class="cf-dialog__content">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	.cf-dialog__backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.cf-dialog {
		background: var(--cf-color-surface);
		border: 1px solid var(--cf-color-border);
		border-radius: var(--cf-radius-lg);
		box-shadow: var(--cf-shadow-lg);
		padding: var(--cf-space-5);
		max-width: min(32rem, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		overflow: auto;
	}

	.cf-dialog__title {
		font-family: var(--cf-font-display);
		font-size: var(--cf-font-size-xl);
		margin: 0 0 var(--cf-space-3);
		color: var(--cf-color-text);
	}
</style>
