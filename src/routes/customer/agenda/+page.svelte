<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import BookingEmails from '$lib/components/BookingEmails.svelte';
  import { bookingService } from '$lib/services/booking';
  import { toasts } from '$lib/stores/toasts';
  import { auth } from '$lib/stores/auth';
  import { onMount } from 'svelte';
  import type { Booking } from '$lib/types/booking';
  import { Plus, Calendar as CalIcon, Mail, X } from 'lucide-svelte';
  import { goto } from '$app/navigation';

  let bookings = $state<Booking[]>([]);
  let loading = $state(true);
  let openEmailsFor = $state<string | null>(null);

  let cancelTarget = $state<Booking | null>(null);
  let cancelOpen = $state(false);
  let cancelReason = $state('');
  let cancelling = $state(false);

  async function load() {
    const customerId = $auth.user?.id;
    if (!customerId) return;
    try {
      bookings = await bookingService.listByCustomer(customerId);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'No se pudieron cargar tus reservas.';
      toasts.push(msg, 'danger');
    }
  }

  onMount(async () => {
    await load();
    loading = false;
  });

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  function statusLabel(s: Booking['status']) {
    if (s === 'CONFIRMADA') return 'Confirmada';
    if (s === 'RESCHEDULED') return 'Reprogramada';
    if (s === 'COMPLETED') return 'Completada';
    return 'Cancelada';
  }

  function statusTone(s: Booking['status']) {
    if (s === 'CONFIRMADA' || s === 'COMPLETED') return 'success';
    if (s === 'RESCHEDULED') return 'info';
    return 'muted';
  }

  const byStart = (a: Booking, b: Booking) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime();

  const upcoming = $derived(
    bookings.filter((b) => new Date(b.startTime) >= new Date() && b.status === 'CONFIRMADA').sort(byStart)
  );
  const history = $derived(
    bookings
      .filter((b) => !(new Date(b.startTime) >= new Date() && b.status === 'CONFIRMADA'))
      .sort((a, b) => byStart(b, a))
  );

  function toggleEmails(id: string) {
    openEmailsFor = openEmailsFor === id ? null : id;
  }

  function askCancel(b: Booking) {
    cancelTarget = b;
    cancelReason = '';
    cancelOpen = true;
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    cancelling = true;
    try {
      await bookingService.cancel(cancelTarget.id, cancelReason.trim() || undefined);
      toasts.push('Reserva cancelada.', 'success');
      cancelOpen = false;
      openEmailsFor = cancelTarget.id;
      await load();
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'No se pudo cancelar la reserva.';
      toasts.push(msg, 'danger');
    } finally {
      cancelling = false;
    }
  }
</script>

<svelte:head>
  <title>Mi agenda · BOOKLY</title>
</svelte:head>

<div class="page">
  <PageHead eyebrow="Tus reservas" title="Mi agenda." description="Lo que viene y lo que ya pasó.">
    {#snippet actions()}
      <Button onclick={() => goto('/customer/services')}>
        <Plus size={16} /> Nueva reserva
      </Button>
    {/snippet}
  </PageHead>

  {#if loading}
    <div class="list">
      {#each Array(3) as _, i (i)}
        <Skeleton lines={2} avatar />
      {/each}
    </div>
  {:else if bookings.length === 0}
    <EmptyState title="Sin reservas todavía." description="Cuando reserves un servicio aparecerá en este lugar.">
      {#snippet action()}
        <Button onclick={() => goto('/customer/services')}>
          <CalIcon size={16} /> Explorar servicios
        </Button>
      {/snippet}
    </EmptyState>
  {:else}
    {#snippet bookingCard(b: Booking, canCancel: boolean)}
      <article class="booking" class:is-cancelled={b.status === 'CANCELADA'}>
        <div class="booking__row">
          <div class="booking__date">
            <span class="booking__day">{new Date(b.startTime).getDate()}</span>
            <span class="booking__month">{new Date(b.startTime).toLocaleDateString('es-ES', { month: 'short' })}</span>
          </div>
          <div class="booking__main">
            <p class="booking__service">{b.serviceName ?? 'Servicio'}</p>
            <p class="booking__meta">{fmtTime(b.startTime)} · {fmtDate(b.startTime)}</p>
            {#if b.status === 'CANCELADA' && b.cancellationReason}
              <p class="booking__reason">Motivo: {b.cancellationReason}</p>
            {/if}
          </div>
          <span class="booking__status booking__status--{statusTone(b.status)}">{statusLabel(b.status)}</span>
        </div>
        <div class="booking__actions">
          <Button variant="ghost" size="sm" onclick={() => toggleEmails(b.id)} aria-expanded={openEmailsFor === b.id}>
            <Mail size={14} /> Correos
          </Button>
          {#if canCancel}
            <Button variant="ghost" size="sm" onclick={() => askCancel(b)}>
              <X size={14} /> Cancelar reserva
            </Button>
          {/if}
        </div>
        {#if openEmailsFor === b.id}
          <BookingEmails bookingId={b.id} />
        {/if}
      </article>
    {/snippet}

    <section class="group" data-od-id="customer-bookings-upcoming">
      <h2 class="group__title">Próximas</h2>
      {#if upcoming.length === 0}
        <p class="group__empty">No tienes reservas próximas.</p>
      {:else}
        <div class="list">
          {#each upcoming as b (b.id)}
            {@render bookingCard(b, true)}
          {/each}
        </div>
      {/if}
    </section>

    {#if history.length}
      <section class="group" data-od-id="customer-bookings-history">
        <h2 class="group__title">Historial</h2>
        <div class="list">
          {#each history as b (b.id)}
            {@render bookingCard(b, false)}
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>

<Modal
  bind:open={cancelOpen}
  title="Cancelar reserva"
  description={cancelTarget
    ? `${cancelTarget.serviceName ?? 'Servicio'} · ${fmtTime(cancelTarget.startTime)} · ${fmtDate(cancelTarget.startTime)}`
    : ''}
  size="sm"
>
  <label class="reason">
    <span class="reason__label">Motivo (opcional)</span>
    <textarea class="reason__input" rows="3" maxlength="500" bind:value={cancelReason} placeholder="Ej.: me surgió un imprevisto"></textarea>
  </label>
  <p class="reason__hint">El horario quedará libre para otros clientes.</p>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (cancelOpen = false)}>Volver</Button>
    <Button variant="danger" loading={cancelling} onclick={confirmCancel}>Cancelar reserva</Button>
  {/snippet}
</Modal>

<style lang="scss">
  @use '$lib/styles/tokens' as *;

  .page {
    padding: $space-7 $space-5 $space-9;
    max-width: 720px;
    margin: 0 auto;

    @media (min-width: #{$bp-md}) {
      padding: $space-9 $space-7;
    }
  }

  .group {
    margin-top: $space-6;
  }

  .group__title {
    font-size: $fs-md;
    font-weight: $fw-semibold;
    color: $text;
    margin-bottom: $space-3;
  }

  .group__empty {
    font-size: $fs-sm;
    color: $muted;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  .booking {
    padding: $space-4 $space-5;
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-md;

    &.is-cancelled {
      opacity: 0.8;
    }
  }

  .booking__row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: $space-4;
    align-items: center;
  }

  .booking__date {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 56px;
    padding: $space-2;
    background: $plum-soft;
    border-radius: $radius-sm;
    color: $plum;
  }

  .booking__day {
    font-family: $font-display;
    font-size: $fs-xl;
    font-weight: $fw-semibold;
    line-height: 1;
  }

  .booking__month {
    font-size: $fs-xs;
    text-transform: uppercase;
    letter-spacing: $ls-wide;
    margin-top: 4px;
  }

  .booking__main {
    min-width: 0;
  }

  .booking__service {
    font-weight: $fw-semibold;
    color: $text;
  }

  .booking__meta,
  .booking__reason {
    font-size: $fs-sm;
    color: $muted;
    margin-top: 2px;
  }

  .booking__actions {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    margin-top: $space-3;
    padding-top: $space-3;
    border-top: 1px solid $border;
  }

  .booking__status {
    font-size: $fs-xs;
    font-weight: $fw-medium;
    padding: 4px 10px;
    border-radius: $radius-pill;
    border: 1px solid $border;
    color: $muted;
    background: $ivory;
  }

  .booking__status--success {
    color: color.adjust($success, $lightness: -8%);
    background: rgba(94, 159, 122, 0.1);
    border-color: rgba(94, 159, 122, 0.2);
  }

  .booking__status--info {
    color: $plum;
    background: $plum-soft;
    border-color: $plum-soft;
  }

  .reason {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  .reason__label {
    font-size: $fs-sm;
    font-weight: $fw-medium;
  }

  .reason__input {
    width: 100%;
    padding: $space-3;
    border: 1px solid $border;
    border-radius: $radius-md;
    background: $surface;
    font: inherit;
    color: $text;
    resize: vertical;
  }

  .reason__hint {
    font-size: $fs-xs;
    color: $muted;
    margin-top: $space-2;
  }
</style>
