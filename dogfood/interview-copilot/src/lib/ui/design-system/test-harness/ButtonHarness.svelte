<script lang="ts">
	import Button from '../Button.svelte';

	interface Props {
		label: string;
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		loading?: boolean;
		disabled?: boolean;
		onclick?: (event: MouseEvent) => void;
	}

	let { label, variant = 'primary', loading = false, disabled = false, onclick }: Props = $props();
</script>

<Button {variant} {loading} {disabled} {onclick}>{label}</Button>
