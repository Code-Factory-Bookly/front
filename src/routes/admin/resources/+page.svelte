<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Button from '$lib/components/Button.svelte';
  import Field from '$lib/components/Field.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Select from '$lib/components/Select.svelte';
  import { resourceService } from '$lib/services/resource';
  import { serviceService } from '$lib/services/service';
  import { toasts } from '$lib/stores/toasts';
  import { onMount } from 'svelte';
  import type { PhysicalResource } from '$lib/types/resource';
  import type { Service } from '$lib/types/service';
  import { Boxes, Link2, Pencil, Plus, X } from 'lucide-svelte';

  let resources = $state<PhysicalResource[]>([]);
  let services = $state<Service[]>([]);
  let loading = $state(true);

  // Formulario de alta y edición
  let formOpen = $state(false);
  let editing = $state<PhysicalResource | null>(null);
  let name = $state('');
  let quantity = $state('1');
  let nameError = $state<string | null>(null);
  let quantityError = $state<string | null>(null);
  let saving = $state(false);

  // Asignación a servicios
  let selectedServiceId = $state('');
  let assigned = $state<string[]>([]);
  let assignedLoading = $state(false);
  let resourceToAssign = $state('');
  let assigning = $state(false);

  // En los 400 de validación el detalle del campo explica el problema; en los demás errores
  // (409 de nombre repetido, por ejemplo) los detalles traen datos, no mensajes.
  function errorMessage(err: unknown, fallback: string) {
    const e = err as { status?: number; message?: string; details?: Record<string, string> };
    const detail = e?.status === 400 && e.details ? Object.values(e.details)[0] : undefined;
    return detail ?? e?.message ?? fallback;
  }

  async function load() {
    loading = true;
    try {
      const [list, catalog] = await Promise.all([resourceService.list(), serviceService.list()]);
      resources = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
      services = catalog;
    } catch (err) {
      toasts.push(errorMessage(err, 'No se pudieron cargar los recursos.'), 'danger');
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function openCreate() {
    editing = null;
    name = '';
    quantity = '1';
    nameError = quantityError = null;
    formOpen = true;
  }

  function openEdit(resource: PhysicalResource) {
    editing = resource;
    name = resource.name;
    quantity = String(resource.totalQuantity);
    nameError = quantityError = null;
    formOpen = true;
  }

  async function save() {
    const qty = Number(quantity);
    nameError = name.trim() ? null : 'El nombre es obligatorio.';
    quantityError = Number.isInteger(qty) && qty >= 1 ? null : 'Debe ser un número entero mayor a cero.';
    if (nameError || quantityError) return;

    saving = true;
    try {
      const input = { name: name.trim(), totalQuantity: qty };
      if (editing) {
        await resourceService.update(editing.id, input);
        toasts.push('Recurso actualizado.', 'success');
      } else {
        await resourceService.create(input);
        toasts.push('Recurso registrado.', 'success');
      }
      formOpen = false;
      await load();
    } catch (err) {
      const e = err as { status?: number };
      const msg = errorMessage(err, 'No se pudo guardar el recurso.');
      if (e?.status === 409) nameError = msg;
      else toasts.push(msg, 'danger');
    } finally {
      saving = false;
    }
  }

  async function loadAssigned() {
    if (!selectedServiceId) {
      assigned = [];
      return;
    }
    assignedLoading = true;
    try {
      assigned = await resourceService.resourcesOfService(selectedServiceId);
    } catch (err) {
      assigned = [];
      toasts.push(errorMessage(err, 'No se pudieron cargar los recursos del servicio.'), 'danger');
    } finally {
      assignedLoading = false;
    }
  }

  // El Select no expone onchange: se reacciona al cambio del servicio elegido.
  $effect(() => {
    void selectedServiceId;
    resourceToAssign = '';
    void loadAssigned();
  });

  async function assign() {
    if (!selectedServiceId || !resourceToAssign) return;
    assigning = true;
    try {
      await resourceService.assign(selectedServiceId, resourceToAssign);
      toasts.push('Recurso asociado al servicio.', 'success');
      resourceToAssign = '';
      await loadAssigned();
    } catch (err) {
      toasts.push(errorMessage(err, 'No se pudo asociar el recurso.'), 'danger');
    } finally {
      assigning = false;
    }
  }

  async function unassign(resourceId: string) {
    try {
      await resourceService.unassign(selectedServiceId, resourceId);
      toasts.push('Recurso retirado del servicio.', 'success');
      await loadAssigned();
    } catch (err) {
      toasts.push(errorMessage(err, 'No se pudo retirar el recurso.'), 'danger');
    }
  }

  const serviceOptions = $derived(services.map((s) => ({ value: s.id, label: s.name })));
  const resourceName = (id: string) => resources.find((r) => r.id === id)?.name ?? 'Recurso';
  const availableToAssign = $derived(
    resources.filter((r) => !assigned.includes(r.id)).map((r) => ({ value: r.id, label: `${r.name} (${r.totalQuantity})` }))
  );
</script>

<svelte:head>
  <title>Recursos · BOOKLY Administración</title>
</svelte:head>

<PageHead
  eyebrow="Operación"
  title="Recursos físicos."
  description="Camillas, salas y equipos limitados. Un servicio que usa un recurso solo se puede reservar mientras quede inventario en ese horario."
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus size={16} /> Nuevo recurso
    </Button>
  {/snippet}
</PageHead>

<div class="layout">
  <section class="card" data-od-id="admin-resources">
    <h2 class="card__title">Inventario</h2>
    {#if loading}
      <Skeleton lines={4} />
    {:else if resources.length === 0}
      <EmptyState title="Todavía no hay recursos" description="Registra el primero para limitar las reservas simultáneas.">
        {#snippet icon()}<Boxes size={28} />{/snippet}
      </EmptyState>
    {:else}
      <ul class="list">
        {#each resources as r (r.id)}
          <li class="row">
            <div class="row__main">
              <p class="row__name">{r.name}</p>
              <p class="row__meta">{r.totalQuantity} {r.totalQuantity === 1 ? 'unidad' : 'unidades'}</p>
            </div>
            <Button variant="ghost" size="sm" onclick={() => openEdit(r)} aria-label={`Editar ${r.name}`}>
              <Pencil size={14} /> Editar
            </Button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="card">
    <h2 class="card__title"><Link2 size={16} /> Recursos por servicio</h2>
    <p class="card__hint">Asocia a cada servicio los recursos que consume durante la cita.</p>
    <Select label="Servicio" options={serviceOptions} placeholder="Elige un servicio" bind:value={selectedServiceId} />

    {#if selectedServiceId}
      {#if assignedLoading}
        <Skeleton lines={2} />
      {:else}
        {#if assigned.length === 0}
          <p class="card__hint">Este servicio no usa recursos limitados.</p>
        {:else}
          <ul class="tags">
            {#each assigned as id (id)}
              <li class="tag">
                {resourceName(id)}
                <button type="button" class="tag__remove" onclick={() => unassign(id)} aria-label={`Retirar ${resourceName(id)}`}>
                  <X size={12} />
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        {#if availableToAssign.length > 0}
          <div class="assign">
            <Select label="Agregar recurso" options={availableToAssign} placeholder="Elige un recurso" bind:value={resourceToAssign} />
            <Button onclick={assign} loading={assigning} disabled={!resourceToAssign}>Asociar</Button>
          </div>
        {/if}
      {/if}
    {/if}
  </section>
</div>

<Modal bind:open={formOpen} title={editing ? 'Editar recurso' : 'Nuevo recurso'} size="sm">
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault();
      void save();
    }}
  >
    <Field label="Nombre" bind:value={name} error={nameError} placeholder="Camilla de masajes" required />
    <Field
      label="Cantidad disponible"
      type="number"
      min={1}
      step={1}
      bind:value={quantity}
      error={quantityError}
      helper="Cuántas reservas pueden usarlo al mismo tiempo."
      required
    />
    <button type="submit" hidden aria-hidden="true"></button>
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (formOpen = false)}>Cancelar</Button>
    <Button onclick={save} loading={saving}>{editing ? 'Guardar cambios' : 'Registrar'}</Button>
  {/snippet}
</Modal>

<style lang="scss">
  @use '$lib/styles/tokens' as *;

  .layout {
    display: grid;
    gap: $space-5;
    grid-template-columns: 1fr;

    @media (min-width: #{$bp-lg}) {
      grid-template-columns: 1.2fr 1fr;
      align-items: start;
    }
  }

  .card {
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-lg;
    padding: $space-5;
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  .card__title {
    display: flex;
    align-items: center;
    gap: $space-2;
    font-size: $fs-lg;
    font-weight: $fw-medium;
    color: $text;
  }

  .card__hint {
    font-size: $fs-sm;
    color: $muted;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
    padding: $space-3 0;
    border-top: 1px solid $border;

    &:first-child {
      border-top: 0;
    }
  }

  .row__main {
    min-width: 0;
  }

  .row__name {
    font-weight: $fw-medium;
    color: $text;
    overflow-wrap: anywhere;
  }

  .row__meta {
    font-size: $fs-sm;
    color: $muted;
  }

  .tags {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: $plum-soft;
    color: $plum;
    border-radius: $radius-pill;
    padding: 4px 6px 4px 12px;
    font-size: $fs-sm;
  }

  .tag__remove {
    display: inline-flex;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 2px;
    border-radius: $radius-pill;

    &:hover {
      background: rgba(0, 0, 0, 0.08);
    }
  }

  .assign {
    display: flex;
    align-items: flex-end;
    gap: $space-3;

    :global(> :first-child) {
      flex: 1;
    }
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }
</style>
