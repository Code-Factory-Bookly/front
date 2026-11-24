<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Button from '$lib/components/Button.svelte';
  import { bookingService } from '$lib/services/booking';
  import { toasts } from '$lib/stores/toasts';
  import { onMount } from 'svelte';
  import type { BookingHistoryPage, BookingStatus } from '$lib/types/booking';
  import { ArrowDownUp, ChevronLeft, ChevronRight, History } from 'lucide-svelte';

  const STATUSES: { value: 'ALL' | BookingStatus; label: string }[] = [
    { value: 'ALL', label: 'Todas' },
    { value: 'CONFIRMADA', label: 'Confirmadas' },
    { value: 'COMPLETED', label: 'Completadas' },
    { value: 'CANCELADA', label: 'Canceladas' },
    { value: 'RESCHEDULED', label: 'Reprogramadas' }
  ];

  const WHEN = [
    { value: 'ALL', label: 'Todo' },
    { value: 'PAST', label: 'Pasadas' },
    { value: 'UPCOMING', label: 'Próximas' }
  ] as const;

  const PAGE_SIZE = 10;

  let status = $state<'ALL' | BookingStatus>('ALL');
  let when = $state<(typeof WHEN)[number]['value']>('ALL');
  let order = $state<'asc' | 'desc'>('desc');
  let page = $state(0);
  let result = $state<BookingHistoryPage | null>(null);
  let loading = $state(true);

  // El backend recibe fechas sin zona (hora local del negocio).
  function localIso(d: Date) {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 19);
  }

  async function load() {
    loading = true;
    const now = localIso(new Date());
    try {
      result = await bookingService.history({
        status: status === 'ALL' ? undefined : status,
        from: when === 'UPCOMING' ? now : undefined,
        to: when === 'PAST' ? now : undefined,
        order,
        page,
        size: PAGE_SIZE
      });
    } catch (err) {
      result = null;
      toasts.push((err as { message?: string })?.message ?? 'No se pudo cargar el historial.', 'danger');
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function setStatus(next: 'ALL' | BookingStatus) {
    status = next;
    page = 0;
    void load();
  }

  function setWhen(next: (typeof WHEN)[number]['value']) {
    when = next;
    page = 0;
    void load();
  }

  function toggleOrder() {
    order = order === 'desc' ? 'asc' : 'desc';
    page = 0;
    void load();
  }

  function goToPage(next: number) {
    page = next;
    void load();
  }

  function statusLabel(s: BookingStatus) {
    if (s === 'CONFIRMADA') return 'Confirmada';
    if (s === 'CANCELADA') return 'Cancelada';
    if (s === 'COMPLETED') return 'Completada';
    return 'Reprogramada';
  }

  function fmtDay(iso: string) {
    return new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
</script>

<svelte:head>
  <title>Historial · BOOKLY</title>
</svelte:head>

<PageHead
  eyebrow="Mis reservas"
  title="Historial."
  description="Todas tus reservas, pasadas y futuras. Filtra por estado o por fecha."
>
  {#snippet actions()}
    <Button variant="ghost" onclick={toggleOrder}>
      <ArrowDownUp size={16} /> {order === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'}
    </Button>
  {/snippet}
</PageHead>

<div class="filters">
  <div class="chips" role="group" aria-label="Fecha">
    {#each WHEN as w (w.value)}
      <button type="button" class="chip" class:is-active={when === w.value} onclick={() => setWhen(w.value)}>{w.label}</button>
    {/each}
  </div>
  <div class="chips" role="group" aria-label="Estado">
    {#each STATUSES as s (s.value)}
      <button type="button" class="chip" class:is-active={status === s.value} onclick={() => setStatus(s.value)}>{s.label}</button>
    {/each}
  </div>
</div>

<section class="history" data-od-id="customer-history">
  {#if loading}
    <Skeleton lines={6} />
  {:else if !result || result.content.length === 0}
    <EmptyState
      title="Sin reservas"
      description={result?.message ?? 'No hay reservas que coincidan con los filtros.'}
    >
      {#snippet icon()}<History size={28} />{/snippet}
    </EmptyState>
  {:else}
    <p class="count">{result.totalElements} {result.totalElements === 1 ? 'reserva' : 'reservas'}</p>
    <ul class="list">
      {#each result.content as b (b.id)}
        <li class="item">
          <div class="item__date">
            <span class="item__day">{fmtDay(b.startTime)}</span>
            <span class="item__time">{fmtTime(b.startTime)} – {fmtTime(b.endTime)}</span>
          </div>
          <div class="item__main">
            <p class="item__service">{b.serviceName ?? 'Servicio'}</p>
            {#if b.professionalName}<p class="item__meta">con {b.professionalName}</p>{/if}
            {#if b.cancellationReason}<p class="item__meta">Motivo: {b.cancellationReason}</p>{/if}
          </div>
          <span class="pill pill--{b.status.toLowerCase()}">{statusLabel(b.status)}</span>
        </li>
      {/each}
    </ul>

    {#if result.totalPages > 1}
      <div class="pager">
        <Button variant="ghost" size="sm" disabled={page === 0} onclick={() => goToPage(page - 1)}>
          <ChevronLeft size={14} /> Anterior
        </Button>
        <span class="pager__label">Página {page + 1} de {result.totalPages}</span>
        <Button variant="ghost" size="sm" disabled={page + 1 >= result.totalPages} onclick={() => goToPage(page + 1)}>
          Siguiente <ChevronRight size={14} />
        </Button>
      </div>
    {/if}
  {/if}
</section>

<style lang="scss">
  @use '$lib/styles/tokens' as *;

  .filters {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    margin-bottom: $space-5;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  .chip {
    border: 1px solid $border;
    background: $surface;
    color: $muted;
    border-radius: $radius-pill;
    padding: 6px 14px;
    font: inherit;
    font-size: $fs-sm;
    cursor: pointer;

    &:hover {
      color: $text;
    }

    &.is-active {
      background: $plum;
      border-color: $plum;
      color: #fff;
    }
  }

  .count {
    font-size: $fs-sm;
    color: $muted;
    margin-bottom: $space-3;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-lg;
    overflow: hidden;
  }

  .item {
    display: grid;
    grid-template-columns: 180px 1fr auto;
    gap: $space-4;
    align-items: center;
    padding: $space-4 $space-5;
    border-top: 1px solid $border;

    &:first-child {
      border-top: 0;
    }

    @media (max-width: #{$bp-md}) {
      grid-template-columns: 1fr auto;

      .item__date {
        grid-column: 1 / -1;
      }
    }
  }

  .item__date {
    display: flex;
    flex-direction: column;
  }

  .item__day {
    font-weight: $fw-medium;
    color: $text;
    text-transform: capitalize;
  }

  .item__time,
  .item__meta {
    font-size: $fs-sm;
    color: $muted;
  }

  .item__main {
    min-width: 0;
  }

  .item__service {
    color: $text;
    overflow-wrap: anywhere;
  }

  .pill {
    font-size: $fs-xs;
    font-weight: $fw-medium;
    padding: 4px 10px;
    border-radius: $radius-pill;
    white-space: nowrap;
    color: $plum;
    background: $plum-soft;
  }

  .pill--completed {
    color: color.adjust($success, $lightness: -8%);
    background: rgba(94, 159, 122, 0.12);
  }

  .pill--cancelada {
    color: $danger;
    background: rgba(200, 80, 80, 0.1);
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-3;
    margin-top: $space-4;
  }

  .pager__label {
    font-size: $fs-sm;
    color: $muted;
  }
</style>
