<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import {
    testAccounts,
    isTestModeEnabled,
    removeTestAccount,
    disableTestMode
  } from '$lib/stores/testAccounts';
  import type { UserRole } from '$lib/types/auth';
  import { Users, X, Trash2 } from 'lucide-svelte';

  let enabled = $state(false);
  let open = $state(false);

  onMount(() => {
    enabled = isTestModeEnabled();
  });

  const ROLE_LABEL: Record<UserRole, string> = {
    ADMIN: 'Admin',
    PROFESSIONAL: 'Profesional',
    CUSTOMER: 'Cliente'
  };

  function homeFor(role: UserRole): string {
    if (role === 'ADMIN') return '/admin';
    if (role === 'PROFESSIONAL') return '/professional';
    return '/customer';
  }

  function switchTo(token: string, user: { id: string; role: UserRole }) {
    auth.setSession(token, user as never);
    open = false;
    goto(homeFor(user.role));
  }

  function remove(event: MouseEvent, userId: string) {
    event.stopPropagation();
    removeTestAccount(userId);
  }

  function turnOff() {
    disableTestMode();
    enabled = false;
    open = false;
  }
</script>

{#if enabled}
  <div class="switcher">
    <button class="switcher__toggle" onclick={() => (open = !open)} aria-label="Cuentas de prueba">
      <Users size={18} />
      {#if $testAccounts.length > 0}<span class="switcher__count">{$testAccounts.length}</span>{/if}
    </button>

    {#if open}
      <div class="switcher__panel">
        <header>
          <span>Cuentas de prueba</span>
          <button onclick={() => (open = false)} aria-label="Cerrar"><X size={14} /></button>
        </header>
        {#if $testAccounts.length === 0}
          <p class="switcher__empty">
            Inicia sesión normalmente; cada cuenta con la que entres se guarda aquí.
          </p>
        {:else}
          <ul>
            {#each $testAccounts as account (account.user.id)}
              <li>
                <button class="switcher__account" onclick={() => switchTo(account.token, account.user)}>
                  <span class="switcher__role">{ROLE_LABEL[account.user.role]}</span>
                  <span class="switcher__email">{account.user.email}</span>
                </button>
                <button class="switcher__remove" onclick={(e) => remove(e, account.user.id)} aria-label="Quitar">
                  <Trash2 size={13} />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <footer>
          <button class="switcher__off" onclick={turnOff}>Apagar modo de prueba</button>
        </footer>
      </div>
    {/if}
  </div>
{/if}

<style>
  .switcher {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 200;
  }
  .switcher__toggle {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    border: 1px solid #e7e3ea;
    background: #2b1f33;
    color: #fff;
    display: grid;
    place-items: center;
    cursor: pointer;
    position: relative;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
  }
  .switcher__count {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #e05252;
    color: #fff;
    font-size: 10px;
    line-height: 1;
    padding: 3px 5px;
    border-radius: 999px;
  }
  .switcher__panel {
    position: absolute;
    bottom: 54px;
    right: 0;
    width: 260px;
    background: #fff;
    border: 1px solid #e7e3ea;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
    padding: 10px;
    font-size: 13px;
  }
  .switcher__panel header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .switcher__panel header button {
    background: none;
    border: none;
    cursor: pointer;
    color: #6b6470;
  }
  .switcher__empty {
    color: #6b6470;
    margin: 4px 0 8px;
  }
  .switcher__panel ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .switcher__panel li {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .switcher__account {
    flex: 1;
    display: grid;
    text-align: left;
    gap: 1px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: #faf8fb;
    cursor: pointer;
  }
  .switcher__account:hover {
    border-color: #cfc8d6;
  }
  .switcher__role {
    font-weight: 600;
    font-size: 11px;
    color: #4a4450;
  }
  .switcher__email {
    font-size: 12px;
    color: #6b6470;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .switcher__remove {
    background: none;
    border: none;
    color: #a3899b;
    cursor: pointer;
    padding: 4px;
  }
  .switcher__panel footer {
    margin-top: 8px;
    border-top: 1px solid #f0edf2;
    padding-top: 6px;
  }
  .switcher__off {
    width: 100%;
    background: none;
    border: none;
    color: #8a1c1c;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    padding: 2px 4px;
  }
</style>
