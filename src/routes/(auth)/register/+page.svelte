<script lang="ts">
  import Field from '$lib/components/Field.svelte';
  import Button from '$lib/components/Button.svelte';
  import { auth } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { toasts } from '$lib/stores/toasts';

  let fullName = $state('');
  let email = $state('');
  let password = $state('');
  let fullNameError = $state<string | null>(null);
  let emailError = $state<string | null>(null);
  let passwordError = $state<string | null>(null);
  let submitting = $state(false);

  const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    fullNameError = null;
    emailError = null;
    passwordError = null;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      fullNameError = 'El nombre completo es obligatorio.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      emailError = 'Introduce un correo válido.';
      return;
    }
    if (password.length < 8 || password.length > 64 || !PASSWORD_RULE.test(password)) {
      passwordError =
        'Debe tener entre 8 y 64 caracteres, con mayúscula, minúscula, número y carácter especial.';
      return;
    }

    submitting = true;
    try {
      await auth.register(trimmedEmail, password, trimmedName);
      toasts.push('Cuenta creada. Ya puedes iniciar sesión.', 'success');
      await goto('/login');
    } catch (err) {
      const e = err as { message?: string; errorCode?: string; details?: Record<string, string> };
      if (e.details?.email) emailError = e.details.email;
      if (e.details?.password) passwordError = e.details.password;
      if (e.details?.fullName) fullNameError = e.details.fullName;
      if (!e.details?.email && !e.details?.password && !e.details?.fullName) {
        toasts.push(e.message ?? 'No pudimos crear la cuenta.', 'danger');
      }
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Crear cuenta · BOOKLY</title>
</svelte:head>

<div class="card">
  <header class="card__head">
    <p class="eyebrow">Registro</p>
    <h1 class="card__title">Crea tu cuenta.</h1>
    <p class="card__lede">Regístrate para reservar servicios y gestionar tus citas.</p>
  </header>

  <form class="form" onsubmit={onSubmit} novalidate>
    <Field
      label="Nombre completo"
      placeholder="Tu nombre completo"
      bind:value={fullName}
      error={fullNameError}
      autocomplete="name"
      required
    />
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
      placeholder="Mayúscula, minúscula, número y símbolo"
      bind:value={password}
      error={passwordError}
      autocomplete="new-password"
      required
    />
    <div class="form__actions">
      <Button type="submit" size="lg" loading={submitting}>Crear cuenta</Button>
    </div>
  </form>

  <p class="card__footer">
    ¿Ya tienes cuenta? <a href="/login">Inicia sesión</a>
  </p>
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
</style>
