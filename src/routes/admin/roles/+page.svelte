<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import Field from '$lib/components/Field.svelte';
  import Select from '$lib/components/Select.svelte';
  import Button from '$lib/components/Button.svelte';
  import { roleService } from '$lib/services/roles';
  import { toasts } from '$lib/stores/toasts';
  import type { UserRole } from '$lib/types/auth';
  import type { RoleAssignment, UserSearchResult } from '$lib/types/roles';

  const ROLE_LABELS: Record<UserRole, string> = {
    CUSTOMER: 'Cliente',
    PROFESSIONAL: 'Profesional',
    ADMIN: 'Administrador'
  };

  const ALL_ROLE_OPTIONS = [
    { value: 'CUSTOMER', label: 'Cliente' },
    { value: 'PROFESSIONAL', label: 'Profesional' },
    { value: 'ADMIN', label: 'Administrador' }
  ];

  let query = $state('');
  let searching = $state(false);
  let results = $state<UserSearchResult[]>([]);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  let selected = $state<UserSearchResult | null>(null);
  let role = $state<UserRole>('CUSTOMER');
  let specialty = $state('');
  let saving = $state(false);
  let errors = $state<Record<string, string>>({});
  let result = $state<RoleAssignment | null>(null);

  // Un profesional con perfil creado no puede cambiar de rol (lo exige el backend); la busqueda
  // evita que el admin tenga que conocer el UUID del usuario de antemano.
  const roleOptions = $derived(
    selected?.hasProfessionalProfile ? ALL_ROLE_OPTIONS.filter((opt) => opt.value === 'PROFESSIONAL') : ALL_ROLE_OPTIONS
  );
  const isNoOp = $derived(selected !== null && role === selected.role);

  // Sin texto se muestran algunas sugerencias (no toda la tabla); a medida que se escribe, la
  // misma busqueda filtra en vivo con un pequeño debounce para no disparar una petición por tecla.
  $effect(() => {
    const trimmed = query.trim();
    result = null;
    if (searchTimer) clearTimeout(searchTimer);
    searching = true;
    searchTimer = setTimeout(async () => {
      try {
        results = await roleService.search(trimmed);
      } catch {
        results = [];
      } finally {
        searching = false;
      }
    }, 300);
  });

  function selectUser(user: UserSearchResult) {
    selected = user;
    role = user.role;
    specialty = '';
    errors = {};
    result = null;
    results = [];
    query = '';
  }

  function clearSelection() {
    selected = null;
    role = 'CUSTOMER';
    specialty = '';
    errors = {};
    result = null;
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (role === 'PROFESSIONAL' && !selected?.hasProfessionalProfile && !specialty.trim()) {
      e.specialty = 'La especialidad es obligatoria para un profesional.';
    }
    errors = e;
    return Object.keys(e).length === 0;
  }

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    result = null;
    if (!selected || !validate()) return;
    saving = true;
    try {
      result = await roleService.assign(selected.id, {
        role,
        specialty: role === 'PROFESSIONAL' ? specialty.trim() : undefined
      });
      toasts.push('Rol actualizado.', 'success');
      selected = { ...selected, role: result.role };
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
  description="Busca a la persona por correo o nombre y asigna su rol. Un profesional con perfil no puede cambiar de rol."
/>

<section class="card">
  {#if !selected}
    <Field label="Buscar usuario" placeholder="Correo o nombre" bind:value={query} />

    {#if searching}
      <p class="hint">Buscando…</p>
    {:else if query.trim().length >= 2 && results.length === 0}
      <p class="hint">No encontramos usuarios con ese correo o nombre.</p>
    {:else if query.trim().length === 0 && results.length}
      <p class="hint">Algunos usuarios existentes. Escribe para filtrar.</p>
    {/if}

    {#if results.length}
      <ul class="results">
        {#each results as user (user.id)}
          <li>
            <button type="button" class="result" onclick={() => selectUser(user)}>
              <span class="result__name">{user.fullName}</span>
              <span class="result__email">{user.email}</span>
              <span class="result__role">{ROLE_LABELS[user.role]}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <div class="selected">
      <div>
        <p class="selected__name">{selected.fullName}</p>
        <p class="selected__email">{selected.email} · rol actual: {ROLE_LABELS[selected.role]}</p>
      </div>
      <button type="button" class="linkish" onclick={clearSelection}>Cambiar usuario</button>
    </div>

    <form onsubmit={onSubmit} novalidate>
      <Select label="Nuevo rol" options={roleOptions} bind:value={role} />
      {#if selected.hasProfessionalProfile}
        <p class="hint">Ya tiene un perfil de profesional creado, así que no se puede cambiar a otro rol.</p>
      {/if}
      {#if role === 'PROFESSIONAL' && !selected.hasProfessionalProfile}
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
        <Button type="submit" loading={saving} disabled={isNoOp}>
          {isNoOp ? 'Ya tiene este rol' : 'Asignar rol'}
        </Button>
      </div>
    </form>

    {#if result}
      <p class="result-msg">
        {result.fullName} ({result.email}) ahora tiene el rol <strong>{ROLE_LABELS[result.role]}</strong>.
      </p>
    {/if}
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
  form {
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
  .hint {
    margin: 0;
    font-size: 14px;
    color: #6b6475;
  }
  .result-msg {
    margin: 0;
    padding: 12px 14px;
    border-radius: 8px;
    background: #eef6ee;
    color: #1d4d1d;
    font-size: 14px;
  }
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
    max-height: 280px;
    overflow-y: auto;
  }
  .result {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 12px;
    text-align: left;
    padding: 10px 12px;
    border: 1px solid #e7e3ea;
    border-radius: 8px;
    background: #fafafa;
    cursor: pointer;
  }
  .result:hover {
    border-color: #382c46;
    background: #f3f0f6;
  }
  .result__name {
    font-weight: 600;
    grid-column: 1;
  }
  .result__role {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    font-size: 12px;
    color: #6b6475;
  }
  .result__email {
    grid-column: 1;
    font-size: 13px;
    color: #6b6475;
  }
  .selected {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .selected__name {
    margin: 0;
    font-weight: 600;
  }
  .selected__email {
    margin: 0;
    font-size: 13px;
    color: #6b6475;
  }
  .linkish {
    background: none;
    border: none;
    color: #382c46;
    font-weight: 500;
    cursor: pointer;
    padding: 0;
    font-size: 13px;
    white-space: nowrap;
  }
</style>
