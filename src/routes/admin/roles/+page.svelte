<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import Field from '$lib/components/Field.svelte';
  import Select from '$lib/components/Select.svelte';
  import Button from '$lib/components/Button.svelte';
  import { roleService } from '$lib/services/roles';
  import { toasts } from '$lib/stores/toasts';
  import type { UserRole } from '$lib/types/auth';
  import type { RoleAssignment } from '$lib/types/roles';

  const roleOptions = [
    { value: 'CUSTOMER', label: 'Cliente' },
    { value: 'PROFESSIONAL', label: 'Profesional' },
    { value: 'ADMIN', label: 'Administrador' }
  ];

  let userId = $state('');
  let role = $state<UserRole>('CUSTOMER');
  let specialty = $state('');
  let saving = $state(false);
  let errors = $state<Record<string, string>>({});
  let result = $state<RoleAssignment | null>(null);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!/^[0-9a-fA-F-]{36}$/.test(userId.trim())) {
      e.userId = 'Introduce el identificador (UUID) del usuario.';
    }
    if (role === 'PROFESSIONAL' && !specialty.trim()) {
      e.specialty = 'La especialidad es obligatoria para un profesional.';
    }
    errors = e;
    return Object.keys(e).length === 0;
  }

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    result = null;
    if (!validate()) return;
    saving = true;
    try {
      result = await roleService.assign(userId.trim(), {
        role,
        specialty: role === 'PROFESSIONAL' ? specialty.trim() : undefined
      });
      toasts.push('Rol actualizado.', 'success');
    } catch (err) {
      const e = err as { message?: string; details?: Record<string, string> };
      errors = { ...errors, ...(e.details ?? {}) };
      toasts.push(e.message ?? 'No se pudo cambiar el rol.', 'danger');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Roles · BOOKLY Administración</title>
</svelte:head>

<PageHead
  eyebrow="Accesos"
  title="Roles."
  description="Asigna el rol de un usuario. Un profesional con perfil no puede cambiar de rol."
/>

<section class="card">
  <form onsubmit={onSubmit} novalidate>
    <Field
      label="Identificador del usuario"
      placeholder="00000000-0000-0000-0000-000000000000"
      bind:value={userId}
      error={errors.userId ?? null}
      required
    />
    <Select label="Nuevo rol" options={roleOptions} bind:value={role} />
    {#if role === 'PROFESSIONAL'}
      <Field
        label="Especialidad"
        placeholder="Ortodoncia"
        bind:value={specialty}
        error={errors.specialty ?? null}
        required
      />
    {/if}

    {#if errors.role}
      <p class="error">{errors.role}</p>
    {/if}

    <div class="actions">
      <Button type="submit" loading={saving}>Asignar rol</Button>
    </div>
  </form>

  {#if result}
    <p class="result">
      {result.fullName} ({result.email}) ahora tiene el rol <strong>{result.role}</strong>.
    </p>
  {/if}
</section>

<style>
  .card {
    background: #fff;
    border: 1px solid #e7e3ea;
    border-radius: 12px;
    padding: 20px;
    max-width: 560px;
    display: grid;
    gap: 14px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }
  .error {
    color: #8a1c1c;
    margin: 0;
    font-size: 14px;
  }
  .result {
    margin: 0;
    padding: 12px 14px;
    border-radius: 8px;
    background: #eef6ee;
    color: #1d4d1d;
    font-size: 14px;
  }
</style>
