<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import Calendar from '$lib/components/Calendar.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { bookingService } from '$lib/services/booking';
  import { scheduleService } from '$lib/services/schedule';
  import { toasts } from '$lib/stores/toasts';
  import { auth } from '$lib/stores/auth';
  import { onMount } from 'svelte';
  import type { Booking } from '$lib/types/booking';
  import type { ScheduleSlot } from '$lib/types/schedule';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';

  let date = $state(new Date());
  let bookings = $state<Booking[]>([]);
  let schedule = $state<ScheduleSlot[] | undefined>(undefined);
  let loading = $state(true);
  let calWrap = $state<HTMLDivElement | undefined>(undefined);
  let calHeight = $state<number | null>(null);

  function shiftDays(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    date = d;
  }

  function fmtDate(d: Date) {
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // Se trae una sola vez: el backend no filtra por fecha, y el Calendar ya arma el día o la
  // semana que corresponda a partir de la lista completa.
  onMount(async () => {
    const professionalId = $auth.user?.id;
    if (!professionalId) {
      loading = false;
      return;
    }
    try {
      // El horario es contexto: si falla, la agenda se muestra igual, solo sin marcar fuera de horario.
      const [list, weekly] = await Promise.all([
        bookingService.listByProfessional(professionalId),
        scheduleService.get(professionalId).catch(() => null)
      ]);
      bookings = list;
      schedule = weekly && weekly.slots.length > 0 ? weekly.slots : undefined;
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'No se pudieron cargar los turnos.';
      toasts.push(msg, 'danger');
    } finally {
      loading = false;
    }
  });

  // Rango de horas visible: lo que cubre el horario y las reservas (con holgura de una hora),
  // para que la semana entre en pantalla sin recorrer horas vacías.
  const hourRange = $derived.by(() => {
    const hours: number[] = [];
    for (const s of schedule ?? []) {
      hours.push(Number(s.startTime.slice(0, 2)), Math.ceil(Number(s.endTime.slice(0, 2)) + Number(s.endTime.slice(3, 5)) / 60));
    }
    for (const b of bookings) {
      if (b.status === 'CANCELADA') continue;
      hours.push(new Date(b.startTime).getHours(), new Date(b.endTime).getHours() + 1);
    }
    if (hours.length === 0) return { start: 8, end: 20 };
    return {
      start: Math.max(0, Math.min(...hours) - 1),
      end: Math.min(24, Math.max(...hours) + 1)
    };
  });

  // Vista auto-switch: week en desktop, day en mobile.
  let view = $state<'day' | 'week'>('day');

  // En semana, el calendario ocupa el alto que queda de la pantalla (medido desde donde
  // empieza) para verse completo sin scroll. En mobile (vista de día) se desplaza como siempre.
  $effect(() => {
    if (typeof window === 'undefined' || view !== 'week' || !calWrap) {
      calHeight = null;
      return;
    }
    const fit = () => {
      if (!calWrap) return;
      const top = calWrap.getBoundingClientRect().top + window.scrollY;
      calHeight = Math.max(360, Math.floor(window.innerHeight - top - 24));
    };
    fit();
    document.documentElement.classList.add('agenda-fit');
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      document.documentElement.classList.remove('agenda-fit');
    };
  });
  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 900px)');
    const sync = () => {
      view = mq.matches ? 'week' : 'day';
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  });
</script>

<svelte:head>
  <title>Mi agenda · BOOKLY Profesional</title>
</svelte:head>

<div class="page">
  <PageHead
    eyebrow="Disponibilidad"
    title="Mi agenda."
    description="Lo que tienes reservado para cada día."
  />

  <div class="toolbar">
    <button type="button" class="nav-btn" aria-label="Día anterior" onclick={() => shiftDays(-1)}>
      <ChevronLeft size={18} />
    </button>
    <span class="toolbar__label">{fmtDate(date)}</span>
    <button type="button" class="nav-btn" aria-label="Día siguiente" onclick={() => shiftDays(1)}>
      <ChevronRight size={18} />
    </button>
  </div>

  {#if loading}
    <Skeleton lines={8} avatar />
  {:else}
    <div class="legend" aria-label="Leyenda">
      {#if schedule}
        <span class="legend__item"><span class="legend__swatch legend__swatch--open"></span>Horario de atención</span>
        <span class="legend__item"><span class="legend__swatch legend__swatch--out"></span>Fuera de horario</span>
      {/if}
      <span class="legend__item"><span class="legend__swatch legend__swatch--booked"></span>Reservado (con el nombre del cliente)</span>
    </div>
    <div class="cal-wrap" bind:this={calWrap} style:height={calHeight ? `${calHeight}px` : undefined}>
      <Calendar
        {date}
        {bookings}
        {view}
        {schedule}
        readonly
        fit
        workdayStart={hourRange.start}
        workdayEnd={hourRange.end}
      />
    </div>
  {/if}
</div>

<style lang="scss">
  @use '$lib/styles/tokens' as *;

  .page {
    padding: $space-7 $space-5 $space-9;
    max-width: 980px;
    margin: 0 auto;

    @media (min-width: #{$bp-md}) {
      padding: $space-6 $space-7 $space-5;
    }
  }

  // Solo con el calendario ajustado a la pantalla (escritorio): sin scroll de página.
  :global(html.agenda-fit) {
    overflow: hidden;
  }

  .cal-wrap {
    min-height: 0;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2 $space-5;
    margin-bottom: $space-3;
    font-size: $fs-xs;
    color: $muted;
  }

  .legend__item {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
  }

  .legend__swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid $border;

    &--open {
      background: $surface;
    }

    &--out {
      background: repeating-linear-gradient(135deg, transparent 0 3px, rgba(0, 0, 0, 0.12) 3px 6px);
    }

    &--booked {
      background: rgba(63, 81, 181, 0.16);
      border-color: $plum;
    }
  }

  .toolbar {
    display: inline-flex;
    align-items: center;
    gap: $space-3;
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-pill;
    padding: 4px;
    margin-bottom: $space-5;
  }

  .nav-btn {
    background: transparent;
    border: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    color: $muted;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &:hover {
      background: $ivory;
      color: $plum;
    }
  }

  .toolbar__label {
    padding: 0 $space-3;
    min-width: 220px;
    text-align: center;
    font-weight: $fw-medium;
    text-transform: capitalize;
  }
</style>