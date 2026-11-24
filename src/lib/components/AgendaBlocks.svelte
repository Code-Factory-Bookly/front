<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { scheduleService } from '$lib/services/schedule';
  import { toasts } from '$lib/stores/toasts';
  import { onMount } from 'svelte';
  import type { AgendaBlock } from '$lib/types/schedule';
  import { CalendarOff, Trash2 } from 'lucide-svelte';

  // HU-05: el profesional bloquea rangos de su agenda (vacaciones, imprevistos).
  interface Props {
    professionalId: string;
  }

  let { professionalId }: Props = $props();

  let blocks = $state<AgendaBlock[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let removingId = $state<string | null>(null);

  // Por defecto: mañana de 08:00 a 18:00, que es el caso típico de un día libre.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  let startTime = $state(`${day}T08:00`);
  let endTime = $state(`${day}T18:00`);
  let reason = $state('');

  // Rechazo del backend: citas que impiden el bloqueo o bloqueos con los que se cruza.
  let problem = $state<{ title: string; items: string[] } | null>(null);

  onMount(async () => {
    try {
      blocks = await scheduleService.listBlocks(professionalId);
    } catch (err) {
      toasts.push((err as { message?: string }).message ?? 'No se pudieron cargar tus bloqueos.', 'danger');
    } finally {
      loading = false;
    }
  });

  function fmtRange(block: Pick<AgendaBlock, 'startTime' | 'endTime'>) {
    const start = new Date(block.startTime);
    const end = new Date(block.endTime);
    const dayFmt = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    const hourFmt = (d: Date) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return start.toDateString() === end.toDateString()
      ? `${dayFmt(start)} · ${hourFmt(start)}–${hourFmt(end)}`
      : `${dayFmt(start)} ${hourFmt(start)} → ${dayFmt(end)} ${hourFmt(end)}`;
  }

  async function create() {
    problem = null;
    saving = true;
    try {
      const created = await scheduleService.createBlock(professionalId, {
        startTime,
        endTime,
        reason: reason.trim() || undefined
      });
      blocks = [...blocks, created].sort((a, b) => a.startTime.localeCompare(b.startTime));
      reason = '';
      toasts.push('Horario bloqueado. Los clientes ya no podrán reservar en ese rango.', 'success');
    } catch (err) {
      const e = err as { message?: string; errorCode?: string; details?: Record<string, string> };
      const items = Object.values(e.details ?? {});
      if (e.errorCode === 'AGENDA_BLOCK_HAS_BOOKINGS') {
        problem = { title: 'No se puede bloquear: tienes estas citas confirmadas en el rango. Cancélalas o reprográmalas primero.', items };
      } else if (e.errorCode === 'AGENDA_BLOCK_OVERLAP') {
        problem = { title: 'Ese rango se cruza con un bloqueo que ya tienes:', items };
      } else if (items.length > 0) {
        problem = { title: e.message ?? 'Revisa las fechas del bloqueo:', items };
      } else {
        toasts.push(e.message ?? 'No se pudo bloquear el horario.', 'danger');
      }
    } finally {
      saving = false;
    }
  }

  async function remove(block: AgendaBlock) {
    removingId = block.id;
    try {
      await scheduleService.deleteBlock(professionalId, block.id);
      blocks = blocks.filter((b) => b.id !== block.id);
      toasts.push('Bloqueo eliminado. Ese horario vuelve a estar disponible.', 'success');
    } catch (err) {
      toasts.push((err as { message?: string }).message ?? 'No se pudo quitar el bloqueo.', 'danger');
    } finally {
      removingId = null;
    }
  }
</script>

<section class="card" data-od-id="agenda-blocks">
  <header class="head">
    <h2><CalendarOff size={18} /> Bloqueos de agenda</h2>
    <p>Bloquea un rango en el que no vas a atender (vacaciones, imprevistos). Los clientes no podrán reservar en él.</p>
  </header>

  <div class="form">
    <label class="field">
      <span>Desde</span>
      <input type="datetime-local" bind:value={startTime} />
    </label>
    <label class="field">
      <span>Hasta</span>
      <input type="datetime-local" bind:value={endTime} />
    </label>
    <label class="field field--wide">
      <span>Motivo (opcional)</span>
      <input type="text" maxlength="200" placeholder="Ej.: vacaciones" bind:value={reason} />
    </label>
    <Button onclick={create} loading={saving}>Bloquear</Button>
  </div>

  {#if problem}
    <div class="problem" role="alert">
      <p>{problem.title}</p>
      <ul>
        {#each problem.items as item, i (i)}
          <li>{item}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if loading}
    <p class="empty">Cargando bloqueos…</p>
  {:else if blocks.length === 0}
    <p class="empty">No tienes bloqueos próximos.</p>
  {:else}
    <ul class="blocks">
      {#each blocks as block (block.id)}
        <li class="block">
          <div>
            <strong>{fmtRange(block)}</strong>
            {#if block.reason}<span class="reason">{block.reason}</span>{/if}
          </div>
          <button
            type="button"
            class="remove"
            onclick={() => remove(block)}
            disabled={removingId === block.id}
            aria-label="Quitar bloqueo"
          >
            <Trash2 size={16} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .card {
    background: #fff;
    border: 1px solid #e7e3ea;
    border-radius: 12px;
    padding: 20px;
    max-width: 760px;
    margin-top: 20px;
  }
  .head h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 4px;
    font-size: 18px;
  }
  .head p {
    margin: 0 0 16px;
    color: #6b6470;
    font-size: 14px;
  }
  .form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
    align-items: end;
  }
  .form :global(button) {
    justify-self: start;
  }
  .field {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: #4a4450;
  }
  .field input {
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid #cfc8d6;
    border-radius: 8px;
    font: inherit;
    background: #fff;
  }
  .problem {
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: 8px;
    background: #fdecec;
    color: #8a1c1c;
    font-size: 14px;
  }
  .problem p {
    margin: 0 0 6px;
  }
  .problem ul {
    margin: 0;
    padding-left: 18px;
  }
  .empty {
    color: #6b6470;
    margin: 16px 0 0;
  }
  .blocks {
    list-style: none;
    padding: 0;
    margin: 16px 0 0;
    display: grid;
    gap: 8px;
  }
  .block {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid #e7e3ea;
    border-radius: 8px;
    text-transform: capitalize;
  }
  .reason {
    display: block;
    color: #6b6470;
    font-size: 13px;
    text-transform: none;
  }
  .remove {
    background: none;
    border: 1px solid #e7e3ea;
    border-radius: 8px;
    padding: 8px;
    cursor: pointer;
    color: #6b6470;
  }
  .remove:disabled {
    opacity: 0.5;
    cursor: default;
  }
  @media (max-width: 700px) {
    .form {
      grid-template-columns: 1fr;
    }
  }
</style>
