<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import Field from '$lib/components/Field.svelte';
  import Button from '$lib/components/Button.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { professionalService } from '$lib/services/professional';
  import { serviceService } from '$lib/services/service';
  import { toasts } from '$lib/stores/toasts';
  import { onMount } from 'svelte';
  import type { Professional, ProfessionalInput } from '$lib/types/professional';
  import type { Service } from '$lib/types/service';
  import { Briefcase, Plus, UserRound, X } from 'lucide-svelte';

  let list = $state<Professional[]>([]);
  let loading = $state(true);
  let listUnavailable = $state(false);
  let showForm = $state(false);
  let saving = $state(false);

  let servicesModalOpen = $state(false);
  let servicesModalProfessional = $state<Professional | null>(null);
  let allServices = $state<Service[]>([]);
  let selectedServiceIds = $state<Set<string>>(new Set());
  let servicesLoading = $state(false);
  let servicesSaving = $state(false);

  let fullName = $state('');
  let email = $state('');
  let password = $state('');
  let specialty = $state('');
  let errors = $state<Record<string, string>>({});

  onMount(async () => {
    try {
      list = await professionalService.list();
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 404 || e.status === 401 || e.status === 405) {
        listUnavailable = true;
      } else {
        const msg = (err as { message?: string })?.message ?? 'No se pudo cargar el equipo.';
        toasts.push(msg, 'danger');
      }
    } finally {
      loading = false;
    }
  });

  function reset() {
    fullName = '';
    email = '';
    password = '';
    specialty = '';
    errors = {};
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'El nombre es obligatorio.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = 'Introduce un correo válido.';
    if (password.length < 8)
      e.password = 'La contraseña debe tener al menos 8 caracteres.';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/.test(password))
      e.password = 'Debe incluir mayúscula, minúscula, número y carácter especial.';
    if (!specialty.trim()) e.specialty = 'La especialidad es obligatoria.';
    errors = e;
    return Object.keys(e).length === 0;
  }

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!validate()) return;
    saving = true;
    const payload: ProfessionalInput = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      specialty: specialty.trim()
    };
    try {
      const created = await professionalService.create(payload);
      list = [created, ...list];
      toasts.push('Profesional añadido.', 'success');
      reset();
      showForm = false;
    } catch (err) {
      const e = err as { message?: string; details?: Record<string, string> };
      if (e.details) errors = { ...errors, ...e.details };
      const msg = e.message ?? 'No se pudo añadir al profesional.';
      toasts.push(msg, 'danger');
    } finally {
      saving = false;
    }
  }

  async function openServicesModal(p: Professional) {
    servicesModalProfessional = p;
    servicesModalOpen = true;
    servicesLoading = true;
    try {
      const [services, assignedIds] = await Promise.all([
        allServices.length ? Promise.resolve(allServices) : serviceService.list(),
        professionalService.services(p.id)
      ]);
      allServices = services;
      selectedServiceIds = new Set(assignedIds);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'No se pudieron cargar los servicios.';
      toasts.push(msg, 'danger');
      servicesModalOpen = false;
    } finally {
      servicesLoading = false;
    }
  }

  function toggleService(id: string) {
    const next = new Set(selectedServiceIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedServiceIds = next;
  }

  async function saveServices() {
    if (!servicesModalProfessional) return;
    servicesSaving = true;
    try {
      await professionalService.replaceServices(
        servicesModalProfessional.id,
        [...selectedServiceIds]
      );
      toasts.push('Servicios actualizados.', 'success');
      servicesModalOpen = false;
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'No se pudieron guardar los servicios.';
      toasts.push(msg, 'danger');
    } finally {
      servicesSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Profesionales · BOOKLY Administración</title>
</svelte:head>

<PageHead
  eyebrow="Equipo"
  title="Profesionales."
  description="Da de alta a las personas que atenderán reservas. Una vez creados, permanecen en el equipo."
>
  {#snippet actions()}
    <Button onclick={() => (showForm = !showForm)}>
      {#if showForm}
        <X size={16} /> Cancelar
      {:else}
        <Plus size={16} /> Añadir profesional
      {/if}
    </Button>
  {/snippet}
</PageHead>

{#if showForm}
  <section class="form-card" data-od-id="professional-create">
    <header class="form-card__head">
      <p class="eyebrow">Nuevo</p>
      <h2 class="form-card__title">Datos del profesional</h2>
    </header>
    <form class="form" onsubmit={onSubmit} novalidate>
      <div class="form__grid">
        <Field
          label="Nombre completo"
          bind:value={fullName}
          error={errors.fullName ?? null}
          placeholder="Nombre y apellido"
          required
        />
        <Field
          label="Especialidad"
          bind:value={specialty}
          error={errors.specialty ?? null}
          placeholder="Barbería"
          required
        />
      </div>
      <Field
        label="Correo"
        type="email"
        bind:value={email}
        error={errors.email ?? null}
        placeholder="profesional@bookly.com"
        autocomplete="email"
        required
      />
      <Field
        label="Contraseña inicial"
        type="password"
        bind:value={password}
        error={errors.password ?? null}
        placeholder="Mínimo 8 caracteres"
        autocomplete="new-password"
        required
      />
      <div class="form__actions">
        <Button variant="ghost" onclick={() => { reset(); showForm = false; }}>Cancelar</Button>
        <Button type="submit" loading={saving}>Añadir al equipo</Button>
      </div>
    </form>
  </section>
{/if}

<section class="team" data-od-id="professionals-list">
  {#if loading}
    <div class="team__list">
      {#each Array(3) as _, i (i)}
        <Skeleton avatar lines={2} />
      {/each}
    </div>
  {:else if listUnavailable}
    <EmptyState
      title="Listado no expuesto en Sprint 1"
      description="El backend todavía no devuelve el equipo; puedes seguir dando altas desde el formulario de arriba."
    />
  {:else if list.length === 0}
    <EmptyState
      title="Aún no hay profesionales"
      description="Cuando añadas al primer miembro del equipo aparecerá aquí."
    >
      {#snippet action()}
        <Button onclick={() => (showForm = true)}>
          <Plus size={16} /> Añadir profesional
        </Button>
      {/snippet}
    </EmptyState>
  {:else}
    <ul class="team__list">
      {#each list as p (p.id)}
        <li class="member">
          <span class="member__avatar" aria-hidden="true">
            <UserRound size={18} />
          </span>
          <div class="member__main">
            <p class="member__name">{p.fullName}</p>
            <p class="member__email">{p.email}</p>
            <p class="member__bio">{p.specialty}</p>
          </div>
          <Button variant="ghost" size="sm" onclick={() => openServicesModal(p)}>
            <Briefcase size={14} /> Servicios
          </Button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<Modal
  bind:open={servicesModalOpen}
  title="Servicios de {servicesModalProfessional?.fullName ?? ''}"
  description="Elige qué servicios atiende este profesional. Los clientes solo podrán reservar con él para estos."
  size="md"
>
  {#if servicesLoading}
    <Skeleton lines={4} />
  {:else if allServices.length === 0}
    <EmptyState title="Sin servicios en el catálogo" description="Crea servicios antes de poder asignarlos." />
  {:else}
    <ul class="service-pick">
      {#each allServices as s (s.id)}
        <li class="service-pick__item">
          <label>
            <input
              type="checkbox"
              checked={selectedServiceIds.has(s.id)}
              onchange={() => toggleService(s.id)}
            />
            <span class="service-pick__name">{s.name}</span>
            <span class="service-pick__category">{s.category}</span>
          </label>
        </li>
      {/each}
    </ul>
  {/if}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (servicesModalOpen = false)}>Cancelar</Button>
    <Button loading={servicesSaving} disabled={servicesLoading} onclick={saveServices}>Guardar</Button>
  {/snippet}
</Modal>

<style lang="scss">
  @use '$lib/styles/tokens' as *;

  .form-card {
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-lg;
    padding: $space-6;
    margin-bottom: $space-8;

    @media (min-width: #{$bp-md}) {
      padding: $space-7;
    }
  }

  .form-card__head {
    margin-bottom: $space-6;
  }

  .form-card__title {
    font-size: $fs-xl;
    margin-top: $space-2;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: $space-5;
  }

  .form__grid {
    display: grid;
    gap: $space-5;
    grid-template-columns: 1fr;

    @media (min-width: #{$bp-md}) {
      grid-template-columns: 1fr 1fr;
    }
  }

  .form__actions {
    display: flex;
    gap: $space-3;
    justify-content: flex-end;
  }

  .team__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-lg;
    overflow: hidden;
  }

  .member {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: $space-4;
    align-items: center;
    padding: $space-5;
    border-top: 1px solid $border;

    &:first-child {
      border-top: 0;
    }
  }

  .member__avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: $plum-soft;
    color: $plum;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .member__main {
    min-width: 0;
  }

  .member__name {
    font-weight: $fw-semibold;
    color: $text;
  }

  .member__email {
    font-size: $fs-sm;
    color: $muted;
    margin-top: 2px;
  }

  .member__bio {
    font-size: $fs-sm;
    color: $muted;
    line-height: $lh-relaxed;
    margin-top: $space-2;
    max-width: 56ch;
  }

  .service-pick {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: $space-2;
    max-height: 320px;
    overflow-y: auto;
  }

  .service-pick__item label {
    display: flex;
    align-items: baseline;
    gap: $space-3;
    padding: $space-3;
    border: 1px solid $border;
    border-radius: $radius-md;
    cursor: pointer;

    &:hover {
      background: $ivory;
    }
  }

  .service-pick__name {
    font-weight: $fw-medium;
    color: $text;
  }

  .service-pick__category {
    font-size: $fs-sm;
    color: $muted;
    margin-left: auto;
  }
</style>