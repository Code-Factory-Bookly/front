<script lang="ts">
  import Field from '$lib/components/Field.svelte';
  import Button from '$lib/components/Button.svelte';
  import { auth } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { toasts } from '$lib/stores/toasts';
  import type { MfaChallenge, MfaEnrollment, User } from '$lib/types/auth';
  import QRCode from 'qrcode';

  type Step = 'credentials' | 'mfa-setup' | 'mfa-verify' | 'recovery-codes';

  let step = $state<Step>('credentials');
  let email = $state('');
  let password = $state('');
  let code = $state('');
  let emailError = $state<string | null>(null);
  let passwordError = $state<string | null>(null);
  let codeError = $state<string | null>(null);
  let submitting = $state(false);

  let challenge = $state<MfaChallenge | null>(null);
  let enrollment = $state<MfaEnrollment | null>(null);
  let qrDataUrl = $state<string | null>(null);
  let recoveryCodes = $state<string[]>([]);
  let pendingUser = $state<User | null>(null);

  function targetFor(user: User) {
    return user.role === 'ADMIN' ? '/admin' : user.role === 'PROFESSIONAL' ? '/professional' : '/customer';
  }

  async function finish(user: User) {
    toasts.push('Sesión iniciada.', 'success');
    await goto(targetFor(user));
  }

  async function beginEnrollment(mfaToken: string) {
    enrollment = await auth.mfaEnroll(mfaToken);
    qrDataUrl = await QRCode.toDataURL(enrollment.otpauthUri, { width: 220, margin: 1 });
  }

  async function onCredentials(e: SubmitEvent) {
    e.preventDefault();
    emailError = null;
    passwordError = null;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      emailError = 'Introduce un correo válido.';
      return;
    }
    if (password.length < 8) {
      passwordError = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }

    submitting = true;
    try {
      const result = await auth.login(trimmed, password);
      if ('user' in result) {
        await finish(result.user);
        return;
      }
      challenge = result.challenge;
      code = '';
      if (challenge.mfaSetupRequired) {
        await beginEnrollment(challenge.mfaToken);
        step = 'mfa-setup';
      } else {
        step = 'mfa-verify';
      }
    } catch (err) {
      const e = err as { message?: string; status?: number; details?: Record<string, string> };
      if (e.details?.email) emailError = e.details.email;
      if (e.details?.password) passwordError = e.details.password;
      const msg =
        e.message ??
        (e.status === 401 ? 'Credenciales inválidas o cuenta bloqueada temporalmente.' : 'No pudimos iniciar sesión.');
      toasts.push(msg, 'danger');
    } finally {
      submitting = false;
    }
  }

  async function onMfaSubmit(e: SubmitEvent) {
    e.preventDefault();
    codeError = null;
    if (!challenge) return;
    if (!code.trim()) {
      codeError = 'Introduce el código de verificación.';
      return;
    }

    submitting = true;
    try {
      if (step === 'mfa-setup') {
        const confirmed = await auth.mfaConfirmEnrollment(challenge.mfaToken, code.trim());
        pendingUser = confirmed.user;
        recoveryCodes = confirmed.recoveryCodes;
        step = 'recovery-codes';
        return;
      }
      pendingUser = await auth.mfaVerify(challenge.mfaToken, code.trim());
      await finish(pendingUser);
    } catch (err) {
      const e = err as { message?: string; status?: number; errorCode?: string };
      if (e.errorCode === 'INVALID_MFA_TOKEN') {
        toasts.push(e.message ?? 'La sesión de verificación expiró.', 'danger');
        resetToCredentials();
        return;
      }
      codeError = e.message ?? 'El código no es válido.';
    } finally {
      submitting = false;
    }
  }

  async function onRecoveryDone() {
    if (pendingUser) await finish(pendingUser);
  }

  function resetToCredentials() {
    step = 'credentials';
    challenge = null;
    enrollment = null;
    qrDataUrl = null;
    code = '';
    codeError = null;
  }
</script>

<svelte:head>
  <title>Iniciar sesión · BOOKLY</title>
</svelte:head>

<div class="card">
  {#if step === 'credentials'}
    <header class="card__head">
      <p class="eyebrow">Acceso</p>
      <h1 class="card__title">Bienvenida de nuevo.</h1>
      <p class="card__lede">Inicia sesión para administrar servicios y profesionales.</p>
    </header>

    <form class="form" onsubmit={onCredentials} novalidate>
      <Field
        label="Correo electrónico"
        type="email"
        placeholder="Copia y pega tu correo"
        bind:value={email}
        error={emailError}
        autocomplete="email"
        required
      />
      <Field
        label="Contraseña"
        type="password"
        placeholder="Tu contraseña"
        bind:value={password}
        error={passwordError}
        autocomplete="current-password"
        required
      />
      <div class="form__actions">
        <Button type="submit" size="lg" loading={submitting}>Entrar</Button>
      </div>
    </form>

    <p class="card__footer">
      ¿No tienes cuenta? <a href="/register">Regístrate</a>
    </p>
  {:else if step === 'mfa-setup' && enrollment}
    <header class="card__head">
      <p class="eyebrow">Segundo factor</p>
      <h1 class="card__title">Activa la verificación en dos pasos.</h1>
      <p class="card__lede">
        Las cuentas de administrador necesitan un código de tu app autenticadora. Escanea el QR con
        Google Authenticator, Authy o Microsoft Authenticator.
      </p>
    </header>

    {#if qrDataUrl}
      <img class="qr" src={qrDataUrl} alt="Código QR para configurar la verificación en dos pasos" width="220" height="220" />
    {/if}

    <details class="manual">
      <summary>¿No puedes escanear el QR?</summary>
      <p>En la app elige "Ingresar clave de configuración" y escribe:</p>
      <code class="secret">{enrollment.secret}</code>
    </details>

    <form class="form" onsubmit={onMfaSubmit} novalidate>
      <Field
        label="Código de 6 dígitos"
        placeholder="123456"
        bind:value={code}
        error={codeError}
        autocomplete="one-time-code"
        required
      />
      <div class="form__actions">
        <Button type="submit" size="lg" loading={submitting}>Confirmar y entrar</Button>
      </div>
    </form>

    <p class="card__footer"><button type="button" class="linkish" onclick={resetToCredentials}>Volver</button></p>
  {:else if step === 'mfa-verify'}
    <header class="card__head">
      <p class="eyebrow">Segundo factor</p>
      <h1 class="card__title">Ingresa tu código.</h1>
      <p class="card__lede">
        Escribe el código de 6 dígitos de tu app. Si no tienes acceso a la app, usa uno de tus códigos de recuperación.
      </p>
    </header>

    <form class="form" onsubmit={onMfaSubmit} novalidate>
      <Field
        label="Código"
        placeholder="123456 o código de recuperación"
        bind:value={code}
        error={codeError}
        autocomplete="one-time-code"
        required
      />
      <div class="form__actions">
        <Button type="submit" size="lg" loading={submitting}>Verificar</Button>
      </div>
    </form>

    <p class="card__footer"><button type="button" class="linkish" onclick={resetToCredentials}>Volver</button></p>
  {:else if step === 'recovery-codes'}
    <header class="card__head">
      <p class="eyebrow">Códigos de recuperación</p>
      <h1 class="card__title">Guárdalos ahora.</h1>
      <p class="card__lede">
        Son 10 códigos de un solo uso. Si pierdes tu teléfono, son la única forma de entrar. No volverán a mostrarse.
      </p>
    </header>

    <ul class="codes">
      {#each recoveryCodes as recovery (recovery)}
        <li><code>{recovery}</code></li>
      {/each}
    </ul>

    <div class="form__actions">
      <Button type="button" size="lg" onclick={onRecoveryDone}>Ya los guardé, continuar</Button>
    </div>
  {/if}
</div>

<style lang="scss">
  @use '$lib/styles/tokens' as *;

  .card {
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-lg;
    padding: $space-8 $space-6;
    box-shadow: $shadow-1;

    @media (min-width: #{$bp-md}) {
      padding: $space-10 $space-8;
    }
  }

  .card__head {
    margin-bottom: $space-7;
  }

  .card__title {
    font-family: $font-display;
    font-size: $fs-3xl;
    font-weight: $fw-semibold;
    letter-spacing: $ls-display;
    line-height: $lh-tight;
    margin: $space-3 0 $space-3;
  }

  .card__lede {
    font-size: $fs-md;
    color: $muted;
    line-height: $lh-relaxed;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: $space-5;
  }

  .form__actions {
    margin-top: $space-3;

    :global(.btn) {
      width: 100%;
    }
  }

  .card__footer {
    margin-top: $space-6;
    font-size: $fs-sm;
    color: $muted;
    text-align: center;

    a {
      color: $plum;
      font-weight: $fw-medium;
    }
  }

  .qr {
    display: block;
    margin: $space-5 auto;
    border-radius: $radius-md;
  }

  .manual {
    font-size: $fs-sm;
    color: $muted;
    margin-bottom: $space-5;

    summary {
      cursor: pointer;
      color: $plum;
    }
  }

  .secret {
    display: block;
    margin-top: $space-2;
    padding: $space-3;
    word-break: break-all;
    background: $ivory;
    border-radius: $radius-sm;
    color: $text;
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

  .linkish {
    background: none;
    border: none;
    color: $plum;
    font-weight: $fw-medium;
    cursor: pointer;
    padding: 0;
  }
</style>
