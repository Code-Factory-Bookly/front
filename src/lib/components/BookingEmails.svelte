<script lang="ts">
  import { onMount } from 'svelte';
  import { bookingService } from '$lib/services/booking';
  import type { BookingNotifications, NotificationDelivery } from '$lib/types/booking';
  import { Mail } from 'lucide-svelte';

  interface Props {
    bookingId: string;
  }

  let { bookingId }: Props = $props();

  let data = $state<BookingNotifications | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      data = await bookingService.notifications(bookingId);
    } catch (err) {
      error = (err as { message?: string })?.message ?? 'No se pudo cargar el registro de correos.';
    } finally {
      loading = false;
    }
  });

  function eventLabel(type: NotificationDelivery['eventType']) {
    if (type === 'BOOKING_CREATED') return 'Confirmación de reserva';
    if (type === 'BOOKING_CANCELLED') return 'Aviso de cancelación';
    return 'Aviso de reprogramación';
  }

  function statusLabel(d: NotificationDelivery, mode: string) {
    if (d.status === 'FAILED') return 'Falló el envío';
    if (d.status === 'PENDING') return 'Pendiente';
    return mode === 'smtp' ? 'Enviado' : 'Generado';
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="emails" data-od-id="booking-emails">
  {#if loading}
    <p class="emails__note">Cargando correos…</p>
  {:else if error}
    <p class="emails__note emails__note--error">{error}</p>
  {:else if data}
    {#if data.deliveries.length === 0}
      <p class="emails__note">Aún no se ha generado ningún correo para esta reserva.</p>
    {:else}
      <ul class="emails__list">
        {#each data.deliveries as d (d.id)}
          <li class="email">
            <span class="email__icon" aria-hidden="true"><Mail size={14} /></span>
            <div class="email__main">
              <p class="email__title">{eventLabel(d.eventType)}</p>
              <p class="email__meta">{d.subject} · para {d.recipientEmail}</p>
              <p class="email__meta">{fmt(d.sentAt ?? d.createdAt)}</p>
              {#if d.errorMessage}
                <p class="email__meta email__meta--error">{d.errorMessage}</p>
              {/if}
            </div>
            <span class="email__status email__status--{d.status.toLowerCase()}">{statusLabel(d, data.deliveryMode)}</span>
          </li>
        {/each}
      </ul>
    {/if}
    {#if data.deliveryMode !== 'smtp'}
      <p class="emails__note">
        En este entorno los correos se generan y quedan registrados en el servidor, pero no se envían a un buzón real.
      </p>
    {/if}
  {/if}
</div>

<style lang="scss">
  @use '$lib/styles/tokens' as *;

  .emails {
    margin-top: $space-3;
    padding: $space-3;
    background: $ivory;
    border-radius: $radius-sm;
  }

  .emails__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  .emails__note {
    font-size: $fs-xs;
    color: $muted;
    margin-top: $space-2;

    &:first-child {
      margin-top: 0;
    }
  }

  .emails__note--error,
  .email__meta--error {
    color: $danger;
  }

  .email {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: $space-3;
    align-items: start;
  }

  .email__icon {
    color: $plum;
    margin-top: 2px;
  }

  .email__main {
    min-width: 0;
  }

  .email__title {
    font-size: $fs-sm;
    font-weight: $fw-medium;
    color: $text;
  }

  .email__meta {
    font-size: $fs-xs;
    color: $muted;
    overflow-wrap: anywhere;
  }

  .email__status {
    font-size: $fs-xs;
    font-weight: $fw-medium;
    padding: 2px 8px;
    border-radius: $radius-pill;
    background: $surface;
    border: 1px solid $border;
    color: $muted;
    white-space: nowrap;
  }

  .email__status--sent {
    color: color.adjust($success, $lightness: -8%);
    border-color: rgba(94, 159, 122, 0.3);
  }

  .email__status--failed {
    color: $danger;
    border-color: $danger;
  }
</style>
