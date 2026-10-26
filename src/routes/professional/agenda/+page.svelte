<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import Calendar from '$lib/components/Calendar.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import { bookingService } from '$lib/services/booking';
  import { scheduleService } from '$lib/services/schedule';
  import { toasts } from '$lib/stores/toasts';
  import { auth } from '$lib/stores/auth';
  import { isWithinSchedule } from '$lib/utils/schedule';
  import { onMount } from 'svelte';
  import type { Booking } from '$lib/types/booking';
  import type { ScheduleSlot } from '$lib/types/schedule';
  import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock } from 'lucide-svelte';

  let date = $state(new Date());
  let bookings = $state<Booking[]>([]);
  let schedule = $state<ScheduleSlot[] | undefined>(undefined);
  let loading = $state(true);
  let calWrap = $state<HTMLDivElement | undefined>(undefined);
  let calHeight = $state<number | null>(null);
  let selected = $state<Booking | null>(null);
  let detailOpen = $state(false);

  // Vista: semana en escritorio y día en móvil, salvo que la persona elija otra.
  let autoView = $state<'day' | 'week'>('day');
  let chosenView = $state<'day' | 'week' | null>(null);
  const view = $derived(chosenView ?? autoView);

  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 900px)');
    const sync = () => {
      autoView = mq.matches ? 'week' : 'day';
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  });

  const active = $derived(bookings.filter((b) => b.status !== 'CANCELADA'));

  function isSameDay(a: Date, b: Date) {
    return a.toDateString() === b.toDateString();
  }

  function mondayOf(d: Date) {
    const m = new Date(d);
    m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return m;
  }

  // Días que muestra la vista actual (lunes a viernes, o solo el día elegido).
  const shownDays = $derived.by(() => {
    if (view === 'day') return [date];
    const monday = mondayOf(date);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  });

  function shift(direction: -1 | 1) {
    const d = new Date(date);
    d.setDate(d.getDate() + direction * (view === 'week' ? 7 : 1));
    date = d;
  }

  function toInputDate(d: Date) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function onPickDate(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    if (!value) return;
    const [y, m, d] = value.split('-').map(Number);
    date = new Date(y, m - 1, d);
  }

  function cap(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  const rangeLabel = $derived.by(() => {
    if (view === 'day') {
      return cap(date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    }
    const first = shownDays[0];
    const last = shownDays[shownDays.length - 1];
    const dow = (d: Date) => cap(d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''));
    const month = cap(last.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''));
    return `${dow(first)}, ${first.getDate()} – ${dow(last)}, ${last.getDate()} ${month}`;
  });

  // Resumen de lo que se está viendo.
  const shownBookings = $derived(
    active.filter((b) => shownDays.some((d) => isSameDay(new Date(b.startTime), d)))
  );

  const nextBooking = $derived(
    active
      .filter((b) => new Date(b.startTime) > new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]
  );

  // Horas de atención que aún están libres en los días visibles (sin contar lo ya pasado).
  const freeHours = $derived.by(() => {
    const sched = schedule;
    if (!sched) return null;
    const now = new Date();
    let free = 0;
    for (const day of shownDays) {
      for (let m = 0; m < 24 * 60; m += 30) {
        const start = new Date(day);
        start.setHours(0, m, 0, 0);
        const end = new Date(start.getTime() + 30 * 60_000);
        if (end <= now || !isWithinSchedule(sched, start, 30)) continue;
        if (active.some((b) => new Date(b.startTime) < end && new Date(b.endTime) > start)) continue;
        free++;
      }
    }
    return free / 2;
  });

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtDay(iso: string) {
    return new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function fmtNext(iso: string) {
    const d = new Date(iso);
    const dow = cap(d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''));
    return `${dow} ${d.getDate()}, ${fmtTime(iso)}`;
  }

  function minutes(b: Booking) {
    return Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60_000);
  }

  function statusLabel(status: Booking['status']) {
    if (status === 'CONFIRMADA') return 'Confirmada';
    if (status === 'CANCELADA') return 'Cancelada';
    if (status === 'COMPLETED') return 'Completada';
    return 'Reprogramada';
  }

  function openDetail(booking: Booking) {
    selected = booking;
    detailOpen = true;
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
      hours.push(
        Number(s.startTime.slice(0, 2)),
        Math.ceil(Number(s.endTime.slice(0, 2)) + Number(s.endTime.slice(3, 5)) / 60)
      );
    }
    for (const b of active) {
      hours.push(new Date(b.startTime).getHours(), new Date(b.endTime).getHours() + 1);
    }
    if (hours.length === 0) return { start: 8, end: 20 };
    return {
      start: Math.max(0, Math.min(...hours) - 1),
      end: Math.min(24, Math.max(...hours) + 1)
    };
  });

  // En semana, el calendario ocupa el alto que queda de la pantalla (medido desde donde
  // empieza) para verse completo sin scroll. En móvil (vista de día) se desplaza como siempre.
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
</script>

<svelte:head>
  <title>Mi agenda · BOOKLY Profesional</title>
</svelte:head>

<div class="page">
  <PageHead eyebrow="Disponibilidad" title="Mi agenda." description="Consulta y administra tus citas.">
    {#snippet actions()}
      <div class="controls">
        <Button variant="secondary" size="sm" onclick={() => (date = new Date())}>
          <CalendarDays size={16} /> Hoy
        </Button>

        <div class="nav">
          <button type="button" class="nav__btn" aria-label="Anterior" onclick={() => shift(-1)}>
            <ChevronLeft size={18} />
          </button>
          <span class="nav__label">{rangeLabel}</span>
          <button type="button" class="nav__btn" aria-label="Siguiente" onclick={() => shift(1)}>
            <ChevronRight size={18} />
          </button>
        </div>

        <input
          class="date-input"
          type="date"
          aria-label="Ir a una fecha"
          value={toInputDate(date)}
          onchange={onPickDate}
        />

        <div class="seg" role="group" aria-label="Vista">
          <button type="button" class:is-on={view === 'week'} onclick={() => (chosenView = 'week')}>Semana</button>
          <button type="button" class:is-on={view === 'day'} onclick={() => (chosenView = 'day')}>Día</button>
        </div>
      </div>
    {/snippet}
  </PageHead>

  <div class="summary">
    <div class="stat">
      <span class="stat__icon"><CalendarDays size={18} /></span>
      <div class="stat__body">
        <span class="stat__label">{view === 'week' ? 'Citas de la semana' : 'Citas del día'}</span>
        <span class="stat__value">{shownBookings.length}</span>
      </div>
    </div>

    <div class="stat">
      <span class="stat__icon"><Clock size={18} /></span>
      <div class="stat__body">
        <span class="stat__label">Próxima cita</span>
        {#if nextBooking}
          <span class="stat__value stat__value--text">{fmtNext(nextBooking.startTime)}</span>
          <span class="stat__hint">{nextBooking.customerName ?? 'Cliente'}</span>
        {:else}
          <span class="stat__value stat__value--text">—</span>
        {/if}
      </div>
    </div>

    <div class="stat">
      <span class="stat__icon stat__icon--ok"><CheckCircle2 size={18} /></span>
      <div class="stat__body">
        <span class="stat__label">Disponibilidad</span>
        <span class="stat__value stat__value--text">
          {freeHours === null ? '—' : `${freeHours.toLocaleString('es-ES')} h libres`}
        </span>
      </div>
    </div>

    <div class="stat stat--legend" aria-label="Leyenda">
      <span class="legend__item"><span class="legend__swatch legend__swatch--booked"></span>Cita reservada</span>
      <span class="legend__item"><span class="legend__swatch legend__swatch--open"></span>Disponible</span>
      {#if schedule}
        <span class="legend__item"><span class="legend__swatch legend__swatch--out"></span>Fuera de horario</span>
      {/if}
    </div>
  </div>

  {#if loading}
    <Skeleton lines={8} avatar />
  {:else}
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
        onBookingClick={openDetail}
      />
    </div>
  {/if}
</div>

<Modal bind:open={detailOpen} title={selected?.customerName ?? 'Cliente'} description="Detalle de la cita" size="sm">
  {#if selected}
    <dl class="detail">
      <div><dt>Servicio</dt><dd>{selected.serviceName ?? 'Servicio'}</dd></div>
      <div><dt>Fecha</dt><dd>{fmtDay(selected.startTime)}</dd></div>
      <div><dt>Hora</dt><dd>{fmtTime(selected.startTime)} – {fmtTime(selected.endTime)}</dd></div>
      <div><dt>Duración</dt><dd>{minutes(selected)} min</dd></div>
      <div><dt>Estado</dt><dd>{statusLabel(selected.status)}</dd></div>
    </dl>
  {/if}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (detailOpen = false)}>Cerrar</Button>
  {/snippet}
</Modal>

<style lang="scss">
  @use '$lib/styles/tokens' as *;

  // Solo con el calendario ajustado a la pantalla (escritorio): sin scroll de página.
  :global(html.agenda-fit) {
    overflow: hidden;
  }

  .page {
    padding: $space-7 $space-5 $space-9;
    margin: 0 auto;

    @media (min-width: #{$bp-md}) {
      padding: $space-6 $space-7 $space-5;
    }

    // El encabezado de esta página es más compacto: el espacio es para la agenda.
    :global(.page-head) {
      margin-bottom: $space-4;
    }
  }

  .cal-wrap {
    min-height: 0;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-3;
  }

  .nav {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-pill;
    padding: 4px;
  }

  .nav__btn {
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

    &:hover {
      background: $ivory;
      color: $plum;
    }
  }

  .nav__label {
    padding: 0 $space-3;
    min-width: 160px;
    text-align: center;
    font-weight: $fw-medium;
    font-size: $fs-sm;
  }

  .date-input {
    height: 36px;
    padding: 0 $space-3;
    border: 1px solid $border;
    border-radius: $radius-pill;
    background: $surface;
    color: $text;
    font-family: inherit;
    font-size: $fs-sm;
  }

  .seg {
    display: inline-flex;
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-pill;
    padding: 3px;

    button {
      border: 0;
      background: transparent;
      padding: 6px 16px;
      border-radius: $radius-pill;
      font-family: inherit;
      font-size: $fs-sm;
      color: $muted;
      cursor: pointer;

      &.is-on {
        background: $plum;
        color: $white;
        font-weight: $fw-medium;
      }
    }
  }

  .summary {
    display: grid;
    gap: $space-3;
    grid-template-columns: 1fr;
    margin-bottom: $space-4;

    @media (min-width: #{$bp-md}) {
      grid-template-columns: repeat(3, 1fr) 1.3fr;
    }
  }

  .stat {
    display: flex;
    align-items: center;
    gap: $space-3;
    padding: $space-3 $space-4;
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-md;
    min-width: 0;
  }

  .stat__icon {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: inline-grid;
    place-items: center;
    background: $plum-soft;
    color: $plum;

    &--ok {
      background: rgba(46, 125, 50, 0.12);
      color: #2e7d32;
    }
  }

  .stat__body {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .stat__label,
  .stat__hint {
    font-size: $fs-xs;
    color: $muted;
  }

  .stat__value {
    font-family: $font-display;
    font-size: $fs-xl;
    font-weight: $fw-semibold;
    color: $text;
    line-height: 1.15;

    &--text {
      font-size: $fs-md;
    }
  }

  .stat--legend {
    flex-wrap: wrap;
    gap: $space-2 $space-4;
    justify-content: center;
    font-size: $fs-xs;
    color: $muted;
  }

  .legend__item {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
  }

  .legend__swatch {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid $border;

    &--open {
      background: $surface;
    }

    &--out {
      background: repeating-linear-gradient(135deg, #fff 0 2px, rgba(0, 0, 0, 0.18) 2px 4px);
    }

    &--booked {
      background: $plum-soft;
      border-color: $plum;
    }
  }

  .detail {
    display: grid;
    gap: $space-3;
    margin: 0;

    div {
      display: flex;
      justify-content: space-between;
      gap: $space-4;
      padding-bottom: $space-2;
      border-bottom: 1px solid $border;
    }

    dt {
      color: $muted;
      font-size: $fs-sm;
    }

    dd {
      margin: 0;
      font-weight: $fw-medium;
      text-align: right;
    }
  }
</style>
