<script lang="ts">
  import '$lib/styles/index.scss';
  import Toaster from '$lib/components/Toaster.svelte';
  import TestAccountSwitcher from '$lib/components/TestAccountSwitcher.svelte';
  import { auth } from '$lib/stores/auth';
  import { enableTestMode } from '$lib/stores/testAccounts';
  import { onMount } from 'svelte';

  let { children } = $props();

  onMount(() => {
    auth.bootstrap();
    if (new URLSearchParams(window.location.search).get('test') === '1') {
      enableTestMode();
    }
  });
</script>

{@render children?.()}
<Toaster />
<TestAccountSwitcher />
