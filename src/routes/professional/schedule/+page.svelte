<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import Button from '$lib/components/Button.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { auth } from '$lib/stores/auth';
  import { scheduleService } from '$lib/services/schedule';
  import { toasts } from '$lib/stores/toasts';
  import { onMount } from 'svelte';
  import { DAY_LABELS, type DayOfWeek, type ScheduleSlot } from '$lib/types/schedule';
  import { Plus, Trash2 } from 'lucide-svelte';

  const days = Object.keys(DAY_LABELS) as DayOfWeek[];

  let slots = $state<ScheduleSlot[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let conflicts = $state<Record<string, string>>({});

  const professionalId = $derived($auth.user?.id ?? null);

  onMount(async () => {
    if (!professionalId) {
      loading = false;
      return;
    }
    try {
      const schedule = await scheduleService.get(professionalId);
      slots = schedule.slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime.slice(0, 5),
        endTime: s.endTime.slice(0, 5)
      }));
    } catch (err) {
      toasts.push((err as { message?: string }).message ?? 'No se pudo cargar tu horario.', 'danger');
    } finally {
      loading = false;
    }
  });

  function etiquetaFranja(franja: string): string {
    const [dia, ...horas] = franja.split(' ');
    const label = DAY_LABELS[dia as DayOfWeek];
    return label ? `${label} ${horas.join(' ')}` : franja;
  }

  function addSlot() {
    slots = [...slots, { dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '12:00' }];
  }

  function removeSlot(index: number) {
    slots = slots.filter((_, i) => i !== index);
  }

  async function save() {
    if (!professionalId) return;
    saving = true;
    conflicts = {};
    try {
      await scheduleService.replace(professionalId, slots);
      toasts.push('Horario guardado.', 'success');
    } catch (err) {
      const e = err as { message?: string; errorCode?: string; details?: Record<string, string> };
      if (e.errorCode === 'SCHEDULE_CONFLICT' && e.details) {
        conflicts = e.details;
      }
      toasts.push(e.message ?? 'No se pudo guardar el horario.', 'danger');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Mi horario · BOOKLY</title>
</svelte:head>

<PageHead
  eyebrow="Agenda"
  title="Mi horario."
  description="Define los días y franjas en que atiendes. Las franjas no pueden superponerse el mismo día."
/>

{#if loading}
  <Skeleton height="220px" />
{:else}
  <section class="card" data-od-id="professional-schedule">
    {#if slots.length === 0}
      <p class="empty">Aún no tienes franjas. Añade la primera.</p>
    {/if}

    <ul class="slots">
      {#each slots as slot, index (index)}
        <li class="slot">
          <label class="field">
            <span>Día</span>
            <select bind:value={slot.dayOfWeek}>
              {#each days as day (day)}
                <option value={day}>{DAY_LABELS[day]}</option>
              {/each}
            </select>
          </label>
          <label class="field">
            <span>Inicio</span>
            <input type="time" bind:value={slot.startTime} />
          </label>
          <label class="field">
            <span>Fin</span>
            <input type="time" bind:value={slot.endTime} />
          </label>
          <button type="button" class="remove" onclick={() => removeSlot(index)} aria-label="Quitar franja">
            <Trash2 size={16} />
          </button>
        </li>
      {/each}
    </ul>

    {#if Object.keys(conflicts).length > 0}
      <div class="conflicts" role="alert">
        <p>Revisa estos horarios:</p>
        <ul>
          {#each Object.entries(conflicts) as [franja, motivo] (franja)}
            <li><strong>{etiquetaFranja(franja)}</strong>: {motivo}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="actions">
      <Button variant="secondary" onclick={addSlot}>
        <Plus size={16} /> Añadir franja
      </Button>
      <Button onclick={save} loading={saving}>Guardar horario</Button>
    </div>
  </section>
{/if}

<style>
  .card {
    background: #fff;
    border: 1px solid #e7e3ea;
    border-radius: 12px;
    padding: 20px;
    max-width: 760px;
  }
  .empty {
    color: #6b6470;
    margin: 0 0 12px;
  }
  .slots {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 12px;
  }
  .slot {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr auto;
    gap: 12px;
    align-items: end;
  }
  .field {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: #4a4450;
  }
  .field select,
  .field input {
    padding: 8px 10px;
    border: 1px solid #cfc8d6;
    border-radius: 8px;
    font: inherit;
    background: #fff;
  }
  .remove {
    background: none;
    border: 1px solid #e7e3ea;
    border-radius: 8px;
    padding: 8px;
    cursor: pointer;
    color: #6b6470;
  }
  .conflicts {
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: 8px;
    background: #fdecec;
    color: #8a1c1c;
    font-size: 14px;
  }
  .conflicts p {
    margin: 0 0 6px;
  }
  .conflicts ul {
    margin: 0;
    padding-left: 18px;
  }
  .actions {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 20px;
  }
</style>
