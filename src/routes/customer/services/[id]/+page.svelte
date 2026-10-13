<script lang="ts">
  import { page } from '$app/stores';
  import PageHead from '$lib/components/PageHead.svelte';
  import Button from '$lib/components/Button.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import Money from '$lib/components/Money.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Select from '$lib/components/Select.svelte';
  import { serviceService } from '$lib/services/service';
  import { professionalService } from '$lib/services/professional';
  import { availabilityService } from '$lib/services/availability';
  import { bookingService } from '$lib/services/booking';
  import { toasts } from '$lib/stores/toasts';
  import { onMount } from 'svelte';
  import type { Service } from '$lib/types/service';
  import type { ProfessionalSummary } from '$lib/types/professional';
  import type { AvailabilityDay, AvailabilitySlot } from '$lib/types/availability';
  import { ArrowLeft, CalendarX, ChevronLeft, ChevronRight } from 'lucide-svelte';
  import { goto } from '$app/navigation';

  const id = $derived($page.params.id);
  const RANGE_DAYS = 14;

  let service = $state<Service | null>(null);
  let professionals = $state<ProfessionalSummary[]>([]);
  let selectedProfessionalId = $state('');
  let loading = $state(true);
  let availabilityLoading = $state(false);
  let submitting = $state(false);
  let date = $state(startOfToday());
  let availabilityDays = $state<AvailabilityDay[]>([]);
  let selectedSlot = $state<AvailabilitySlot | null>(null);
  let notFound = $state(false);

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function toIsoDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function isBeforeToday(d: Date) {
    return toIsoDate(d) < toIsoDate(startOfToday());
  }

  function shiftDays(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    if (isBeforeToday(d)) return;
    date = d;
    selectedSlot = null;
  }

  function fmtDate(d: Date) {
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function fmtHour(iso: string) {
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  const slotsForDay = $derived.by(() => {
    const iso = toIsoDate(date);
    return availabilityDays.find((d) => d.date === iso)?.slots ?? [];
  });

  async function loadAvailability() {
    if (!service || !selectedProfessionalId) return;
    availabilityLoading = true;
    selectedSlot = null;
    try {
      const from = startOfToday();
      const to = new Date(from);
      to.setDate(to.getDate() + RANGE_DAYS);
      const response = await availabilityService.find({
        professionalId: selectedProfessionalId,
        serviceId: id,
        from: toIsoDate(from),
        to: toIsoDate(to)
      });
      availabilityDays = response.days;
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'No se pudo cargar la disponibilidad.';
      toasts.push(msg, 'danger');
      availabilityDays = [];
    } finally {
      availabilityLoading = false;
    }
  }

  onMount(async () => {
    try {
      service = await serviceService.get(id);
      professionals = await professionalService.forService(id);
      if (professionals.length > 0) {
        selectedProfessionalId = professionals[0].id;
      }
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e.status === 404) notFound = true;
      else toasts.push(e.message ?? 'No se pudo cargar el servicio.', 'danger');
    } finally {
      loading = false;
    }
  });

  // El Select no reenvía eventos nativos; reaccionar al cambio de id es más simple que cablear
  // un onchange a través de un componente que no lo expone.
  $effect(() => {
    if (selectedProfessionalId) loadAvailability();
  });

  function handleSlotClick(slot: AvailabilitySlot) {
    selectedSlot = selectedSlot?.startTime === slot.startTime ? null : slot;
  }

  async function confirmBooking() {
    if (!service || !selectedSlot || !selectedProfessionalId) return;
    submitting = true;
    try {
      await bookingService.create({
        professionalId: selectedProfessionalId,
        serviceId: id,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime
      });
      toasts.push('Reserva confirmada.', 'success');
      goto('/customer/agenda');
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'No se pudo confirmar la reserva.';
      toasts.push(msg, 'danger');
      await loadAvailability();
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{service?.name ?? 'Servicio'} · BOOKLY</title>
</svelte:head>

<div class="page">
  <a class="back" href="/customer/services">
    <ArrowLeft size={14} /> Servicios
  </a>

  {#if loading}
    <Skeleton lines={6} avatar />
  {:else if notFound || !service}
    <PageHead title="Servicio no disponible" description="Este servicio ya no está activo." />
    <Button onclick={() => goto('/customer/services')}>Volver</Button>
  {:else}
    <header class="hero">
      <p class="eyebrow">{service.category}</p>
      <h1 class="hero__title">{service.name}</h1>
      <p class="hero__desc">{service.description}</p>
      <div class="hero__meta">
        <span><Money value={service.price} /></span>
        <span class="hero__dot" aria-hidden="true">·</span>
        <span>{service.durationMinutes} min</span>
      </div>
    </header>

    {#if professionals.length === 0}
      <EmptyState
        title="Sin profesionales disponibles"
        description="Todavía no hay nadie en el equipo que ofrezca este servicio. Vuelve a intentarlo más tarde."
      >
        {#snippet icon()}
          <CalendarX size={24} />
        {/snippet}
      </EmptyState>
    {:else}
      <section class="picker" data-od-id="customer-booking-picker">
        <div class="picker__professional">
          <Select
            label="Profesional"
            bind:value={selectedProfessionalId}
            options={professionals.map((p) => ({ value: p.id, label: `${p.fullName} · ${p.specialty}` }))}
          />
        </div>

        <div class="picker__head">
          <p class="eyebrow">Disponibilidad</p>
          <div class="picker__date">
            <button
              type="button"
              class="picker__nav"
              aria-label="Día anterior"
              disabled={isBeforeToday(new Date(date.getTime() - 86400000))}
              onclick={() => shiftDays(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span class="picker__date-label">{fmtDate(date)}</span>
            <button type="button" class="picker__nav" aria-label="Día siguiente" onclick={() => shiftDays(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {#if availabilityLoading}
          <Skeleton lines={3} />
        {:else if slotsForDay.length === 0}
          <EmptyState
            title="Sin horarios libres este día"
            description="Elige otro día o prueba con otro profesional."
          />
        {:else}
          <ul class="slots">
            {#each slotsForDay as slot (slot.startTime)}
              {@const isSelected = selectedSlot?.startTime === slot.startTime}
              <li>
                <button
                  type="button"
                  class="slot"
                  class:is-selected={isSelected}
                  aria-pressed={isSelected}
                  onclick={() => handleSlotClick(slot)}
                >
                  {fmtHour(slot.startTime)}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <div class="cta">
        <Button
          size="lg"
          disabled={!selectedSlot}
          loading={submitting}
          onclick={confirmBooking}
        >
          {selectedSlot ? `Confirmar ${fmtHour(selectedSlot.startTime)}` : 'Elige un horario'}
        </Button>
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  @use '$lib/styles/tokens' as *;

  .page {
    padding: $space-7 $space-5 $space-9;
    max-width: 880px;
    margin: 0 auto;

    @media (min-width: #{$bp-md}) {
      padding: $space-9 $space-7;
    }
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: $muted;
    font-size: $fs-sm;
    margin-bottom: $space-5;

    &:hover {
      color: $plum;
    }
  }

  .hero {
    margin-bottom: $space-8;
  }

  .hero__title {
    font-family: $font-display;
    font-size: clamp(28px, 4vw, 38px);
    font-weight: $fw-semibold;
    letter-spacing: $ls-display;
    line-height: 1.15;
    margin: $space-2 0 $space-3;
  }

  .hero__desc {
    font-size: $fs-md;
    color: $muted;
    line-height: $lh-relaxed;
    max-width: 56ch;
  }

  .hero__meta {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
    margin-top: $space-5;
    font-size: $fs-md;
    color: $text;
    font-weight: $fw-semibold;
  }

  .hero__dot {
    color: $border;
  }

  .picker {
    margin-bottom: $space-8;
  }

  .picker__professional {
    max-width: 360px;
    margin-bottom: $space-6;
  }

  .picker__head {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    margin-bottom: $space-4;

    @media (min-width: #{$bp-md}) {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  .picker__date {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-pill;
    padding: 4px;
    align-self: flex-start;
  }

  .picker__nav {
    background: transparent;
    border: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: $muted;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: $ivory;
      color: $plum;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .picker__date-label {
    padding: 0 $space-3;
    text-transform: capitalize;
    font-weight: $fw-medium;
    font-size: $fs-sm;
  }

  .slots {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: $space-3;
    padding: 0;
    margin: 0;
  }

  .slot {
    appearance: none;
    border: 1px solid $border;
    background: $surface;
    border-radius: $radius-pill;
    padding: $space-3 $space-5;
    font-size: $fs-sm;
    font-weight: $fw-medium;
    color: $text;
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);

    &:hover {
      background: color.adjust($plum-soft, $lightness: 4%);
      border-color: $plum;
    }

    &.is-selected {
      background: $plum;
      border-color: $plum;
      color: white;
    }
  }

  .cta {
    position: sticky;
    bottom: 80px;

    @media (min-width: #{$bp-md}) {
      position: static;
    }

    :global(.btn) {
      width: 100%;
    }
  }
</style>
