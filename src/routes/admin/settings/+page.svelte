<script lang="ts">
  import { onMount } from 'svelte';
  import PageHead from '$lib/components/PageHead.svelte';
  import Button from '$lib/components/Button.svelte';
  import Field from '$lib/components/Field.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import OtpInput from '$lib/components/OtpInput.svelte';
  import Switch from '$lib/components/Switch.svelte';
  import { auth } from '$lib/stores/auth';
  import { toasts } from '$lib/stores/toasts';

  const LOW_RECOVERY_THRESHOLD = 2;

  let recoveryRemaining = $state<number | null>(null);
  let loadingStatus = $state(true);

  let regenerateOpen = $state(false);
  let regenerateCode = $state('');
  let regenerateError = $state<string | null>(null);
  let regenerating = $state(false);
  let newRecoveryCodes = $state<string[]>([]);
  let newCodesSaved = $state(false);

  let disableOpen = $state(false);
  let disablePassword = $state('');
  let disableCode = $state('');
  let disableError = $state<string | null>(null);
  let disabling = $state(false);

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let passwordError = $state<string | null>(null);
  let changingPassword = $state(false);

  onMount(loadStatus);

  async function loadStatus() {
    loadingStatus = true;
    try {
      const status = await auth.mfaRecoveryStatus();
      recoveryRemaining = status.remaining;
    } catch {
      recoveryRemaining = null;
    } finally {
      loadingStatus = false;
    }
  }

  function openRegenerate() {
    regenerateCode = '';
    regenerateError = null;
    newRecoveryCodes = [];
    newCodesSaved = false;
    regenerateOpen = true;
  }

  function closeRegenerate() {
    regenerateOpen = false;
  }

  async function onRegenerateComplete(code: string) {
    regenerateError = null;
    regenerating = true;
    try {
      const result = await auth.mfaRegenerateRecoveryCodes(code);
      newRecoveryCodes = result.recoveryCodes;
      newCodesSaved = false;
      recoveryRemaining = result.recoveryCodes.length;
      toasts.push('Códigos de recuperación renovados.', 'success');
    } catch (err) {
      const e = err as { message?: string };
      regenerateCode = '';
      regenerateError = e.message ?? 'El código no es válido.';
    } finally {
      regenerating = false;
    }
  }

  function openDisable() {
    disablePassword = '';
    disableCode = '';
    disableError = null;
    disableOpen = true;
  }

  async function onDisableSubmit(e: SubmitEvent) {
    e.preventDefault();
    disableError = null;
    if (!disablePassword || !disableCode) {
      disableError = 'Completa la contraseña y el código.';
      return;
    }
    disabling = true;
    try {
      await auth.mfaDisable(disablePassword, disableCode);
      disableOpen = false;
      recoveryRemaining = null;
      toasts.push('Segundo factor desactivado. Se te pedirá configurarlo de nuevo en tu próximo acceso.', 'success');
    } catch (err) {
      const e = err as { message?: string };
      disableError = e.message ?? 'No pudimos desactivar el segundo factor.';
    } finally {
      disabling = false;
    }
  }

  async function onChangePassword(e: SubmitEvent) {
    e.preventDefault();
    passwordError = null;
    if (newPassword !== confirmPassword) {
      passwordError = 'Las contraseñas nuevas no coinciden.';
      return;
    }
    changingPassword = true;
    try {
      await auth.changePassword(currentPassword, newPassword);
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      toasts.push('Contraseña actualizada.', 'success');
    } catch (err) {
      const e = err as { message?: string; details?: Record<string, string> };
      passwordError = e.details?.newPassword ?? e.details?.currentPassword ?? e.message ?? 'No pudimos cambiar la contraseña.';
    } finally {
      changingPassword = false;
    }
  }
</script>

<svelte:head>
  <title>Configuración · BOOKLY Administración</title>
</svelte:head>

<PageHead
  eyebrow="Ajustes"
  title="Configuración."
  description="Seguridad de tu cuenta de administrador."
/>

<section class="panel">
  <h2 class="panel__title">Verificación en dos pasos</h2>

  {#if !loadingStatus && recoveryRemaining !== null}
    <p class="panel__desc">
      Te quedan <strong>{recoveryRemaining}</strong> de 10 códigos de recuperación sin usar.
    </p>
    {#if recoveryRemaining <= LOW_RECOVERY_THRESHOLD}
      <p class="warning">
        Te quedan pocos códigos de recuperación. Si pierdes el teléfono y se te acaban, no vas a poder entrar.
      </p>
    {/if}
  {/if}

  <div class="panel__actions">
    <Button variant="secondary" onclick={openRegenerate}>Regenerar códigos de recuperación</Button>
    <Button variant="danger" onclick={openDisable}>Desactivar segundo factor</Button>
  </div>
</section>

<section class="panel">
  <h2 class="panel__title">Cambiar contraseña</h2>
  <form class="form" onsubmit={onChangePassword} novalidate>
    <Field
      label="Contraseña actual"
      type="password"
      bind:value={currentPassword}
      autocomplete="current-password"
      required
    />
    <Field
      label="Contraseña nueva"
      type="password"
      bind:value={newPassword}
      error={passwordError}
      autocomplete="new-password"
      helper="Mayúscula, minúscula, número y carácter especial."
      required
    />
    <Field
      label="Confirmar contraseña nueva"
      type="password"
      bind:value={confirmPassword}
      autocomplete="new-password"
      required
    />
    <div class="panel__actions">
      <Button type="submit" loading={changingPassword}>Guardar contraseña</Button>
    </div>
  </form>
</section>

<Modal bind:open={regenerateOpen} title="Regenerar códigos de recuperación" size="sm">
  {#if newRecoveryCodes.length}
    <p class="modal__lede">Guarda estos códigos ahora. Los anteriores ya no sirven.</p>
    <ul class="codes">
      {#each newRecoveryCodes as recovery (recovery)}
        <li><code>{recovery}</code></li>
      {/each}
    </ul>
    <Switch label="Ya guardé estos códigos en un lugar seguro" bind:checked={newCodesSaved} />
    <Button onclick={closeRegenerate} disabled={!newCodesSaved}>Listo</Button>
  {:else}
    <p class="modal__lede">Escribe el código de tu app autenticadora para confirmar.</p>
    <OtpInput bind:value={regenerateCode} error={regenerateError} disabled={regenerating} onComplete={onRegenerateComplete} />
  {/if}
</Modal>

<Modal bind:open={disableOpen} title="Desactivar segundo factor" size="sm">
  <p class="modal__lede">
    Vuelves a quedar protegido solo por contraseña. En tu próximo acceso tendrás que configurar el
    segundo factor de nuevo.
  </p>
  <form class="form" onsubmit={onDisableSubmit} novalidate>
    <Field label="Contraseña" type="password" bind:value={disablePassword} autocomplete="current-password" required />
    <Field label="Código de la app" bind:value={disableCode} error={disableError} autocomplete="one-time-code" required />
    <Button type="submit" variant="danger" loading={disabling}>Desactivar</Button>
  </form>
</Modal>

<style lang="scss">
  @use '$lib/styles/tokens' as *;

  .panel {
    max-width: 560px;
    padding: $space-6;
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-lg;
    display: flex;
    flex-direction: column;
    gap: $space-4;
    margin-bottom: $space-6;
  }

  .panel__title {
    font-size: $fs-lg;
    font-family: $font-display;
    color: $text;
  }

  .panel__desc {
    color: $muted;
    line-height: $lh-relaxed;
  }

  .panel__actions {
    display: flex;
    gap: $space-3;
    flex-wrap: wrap;
  }

  .warning {
    padding: $space-3;
    background: rgba(217, 107, 104, 0.1);
    border: 1px solid $danger;
    border-radius: $radius-sm;
    color: $danger;
    font-size: $fs-sm;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }

  .modal__lede {
    color: $muted;
    margin-bottom: $space-4;
    line-height: $lh-relaxed;
  }

  .codes {
    list-style: none;
    padding: 0;
    margin: 0 0 $space-5;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-3;

    code {
      display: block;
      padding: $space-3;
      background: $ivory;
      border-radius: $radius-sm;
      text-align: center;
      font-family: monospace;
    }
  }
</style>
