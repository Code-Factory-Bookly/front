<script lang="ts">
  import type { Booking, SlotState, TimeSlot } from '$lib/types/booking';
  import type { DayOfWeek, ScheduleSlot } from '$lib/types/schedule';

  interface Props {
    date: Date;
    bookings: Booking[];
    view: 'day' | 'week';
    workdayStart?: number;
    workdayEnd?: number;
    slotMinutes?: number;
    selectedSlot?: string | null;
    /** Franjas del horario semanal: lo que queda fuera se marca "Fuera de horario". */
    schedule?: ScheduleSlot[];
    /** Solo lectura (agenda propia): no invita a seleccionar horas libres. */
    readonly?: boolean;
    /** En semana, ajusta el alto a la pantalla para ver todo sin hacer scroll. */
    fit?: boolean;
    onSlotClick?: (slot: TimeSlot) => void;
  }

  let {
    date,
    bookings,
    view,
    workdayStart = 8,
    workdayEnd = 20,
    slotMinutes = 30,
    selectedSlot = null,
    schedule,
    readonly = false,
    fit = false,
    onSlotClick
  }: Props = $props();

  const slotsPerHour = $derived(60 / slotMinutes);

  const DAYS: DayOfWeek[] = [
    'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'
  ];

  function toMinutes(time: string) {
    const [h, m] = time.split(':');
    return Number(h) * 60 + Number(m);
  }

  function inSchedule(start: Date) {
    if (!schedule) return true;
    const day = DAYS[start.getDay()];
    const minutes = start.getHours() * 60 + start.getMinutes();
    return schedule.some(
      (s) =>
        s.dayOfWeek === day &&
        minutes >= toMinutes(s.startTime) &&
        minutes + slotMinutes <= toMinutes(s.endTime)
    );
  }

  function buildDaySlots(day: Date): TimeSlot[] {
    const out: TimeSlot[] = [];
    const base = new Date(day);
    base.setHours(workdayStart, 0, 0, 0);
    const totalSlots = (workdayEnd - workdayStart) * slotsPerHour;
    for (let i = 0; i < totalSlots; i++) {
      const start = new Date(base.getTime() + i * slotMinutes * 60_000);
      const end = new Date(start.getTime() + slotMinutes * 60_000);
      // Una reserva ocupa todas las franjas que cubre, no solo la de inicio.
      const booking = bookings.find(
        (b) =>
          b.status !== 'CANCELADA' && new Date(b.startTime) < end && new Date(b.endTime) > start
      );
      const bookingStart = booking ? new Date(booking.startTime) >= start : false;
      const state: SlotState = booking
        ? 'BOOKED'
        : inSchedule(start)
          ? 'AVAILABLE'
          : 'OUT_OF_HOURS';
      out.push({ start: start.toISOString(), end: end.toISOString(), state, booking, bookingStart });
    }
    return out;
  }

  function isSameDay(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  const daySlots = $derived(buildDaySlots(date));
  const today = new Date();

  const weekDays = $derived.by(() => {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diffToMonday);
    return Array.from({ length: 5 }, (_, i) => {
      const nd = new Date(monday);
      nd.setDate(monday.getDate() + i);
      return nd;
    });
  });

  const nowLineTop = $derived.by(() => {
    if (!isSameDay(date, today)) return null;
    const startOfDay = new Date(date);
    startOfDay.setHours(workdayStart, 0, 0, 0);
    const totalSeconds = (today.getTime() - startOfDay.getTime()) / 1000;
    const workSeconds = (workdayEnd - workdayStart) * 3600;
    if (totalSeconds < 0 || totalSeconds > workSeconds) return null;
    const pct = (totalSeconds / workSeconds) * 100;
    return `${pct}%`;
  });

  function fmtHour(d: string | Date) {
    return new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtDow(d: Date) {
    return d.toLocaleDateString('es-ES', { weekday: 'short' });
  }

  function fmtDay(d: Date) {
    return d.getDate();
  }

  function stateLabel(state: SlotState) {
    switch (state) {
      case 'AVAILABLE': return 'Disponible';
      case 'BOOKED': return 'Ocupado';
      case 'NO_SERVICE': return 'Sin servicio';
      case 'OUT_OF_HOURS': return 'Fuera de horario';
      case 'SELECTED': return 'Seleccionado';
    }
  }

  function clickSlot(slot: TimeSlot) {
    if (slot.state === 'BOOKED') return;
    onSlotClick?.(slot);
  }
</script>

{#if view === 'day'}
  <div class="cal cal--day" data-od-id="calendar-day">
    <div class="day-header">
      <span class="day-header__date">
        {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
      {#if isSameDay(date, today)}
        <span class="day-header__today">Hoy</span>
      {/if}
    </div>

    <div class="day-grid">
        <div class="day-time-col" aria-hidden="true">
          {#each Array((workdayEnd - workdayStart) * slotsPerHour) as _, i (i)}
            <div class="day-time-cell" class:is-hour-mark={i % slotsPerHour === 0}>
              {#if i % slotsPerHour === 0}
                <span class="day-time-label">{String(workdayStart + Math.floor(i / slotsPerHour)).padStart(2, '0')}:00</span>
              {/if}
            </div>
          {/each}
        </div>

        <div class="day-slots-col">
          {#each daySlots as slot, i (slot.start)}
            {@const hourLabel = fmtHour(slot.start)}
            {@const isHourMark = i % slotsPerHour === 0}
            {@const isSelected = selectedSlot === slot.start}
            <button
              type="button"
              class="day-slot"
              class:is-hour-mark={isHourMark}
              class:is-selected={isSelected}
              class:is-booked={slot.state === 'BOOKED'}
              class:is-out={slot.state === 'OUT_OF_HOURS'}
              class:is-readonly={readonly}
              disabled={slot.state === 'BOOKED'}
              aria-pressed={isSelected}
              aria-label={`${hourLabel} · ${stateLabel(isSelected ? 'SELECTED' : slot.state)}${slot.booking ? ` · ${slot.booking.customerName ?? 'Cliente'}` : ''}`}
              onclick={() => clickSlot(slot)}
            >
              {#if slot.booking && slot.bookingStart}
                <span class="day-slot__bar" aria-hidden="true"></span>
                <span class="day-slot__time">{hourLabel}</span>
                <span class="day-slot__customer">{slot.booking.customerName ?? 'Cliente'}</span>
                <span class="day-slot__service">{slot.booking.serviceName ?? 'Servicio'}</span>
              {:else if slot.booking}
                <span class="day-slot__time">{hourLabel}</span>
              {:else if slot.state === 'OUT_OF_HOURS'}
                <span class="day-slot__time">{hourLabel}</span>
                <span class="day-slot__hint">Fuera de horario</span>
              {:else}
                <span class="day-slot__time">{hourLabel}</span>
                <span class="day-slot__hint">{readonly ? 'Disponible' : 'Toca para seleccionar'}</span>
              {/if}
            </button>
          {/each}

          {#if nowLineTop}
            <div class="now-line" style="top: {nowLineTop}" aria-hidden="true">
              <span class="now-line__dot"></span>
            </div>
          {/if}
        </div>
      </div>
  </div>
{:else}
  <div class="cal cal--week" class:cal--fit={fit} data-od-id="calendar-week">
    <div class="week-header">
      <div class="week-header__time-spacer" aria-hidden="true"></div>
      {#each weekDays as wd (wd.toISOString())}
        <div
          class="week-header__day"
          class:is-today={isSameDay(wd, today)}
          class:is-selected-day={isSameDay(wd, date)}
        >
          <span class="week-header__dow">{fmtDow(wd)}</span>
          <span class="week-header__num">{fmtDay(wd)}</span>
        </div>
      {/each}
    </div>

    <div class="week-grid">
      <div class="week-col week-col--time">
        {#each Array((workdayEnd - workdayStart) * slotsPerHour) as _, i (i)}
          <div class="week-time">
            {#if i % slotsPerHour === 0}
              <span>{String(workdayStart + Math.floor(i / slotsPerHour)).padStart(2, '0')}:00</span>
            {/if}
          </div>
        {/each}
      </div>
      {#each weekDays as wd, dayIdx (wd.toISOString())}
        {@const slots = buildDaySlots(wd)}
        {@const isToday = isSameDay(wd, today)}
        {@const isSelectedDay = isSameDay(wd, date)}
        <div class="week-col" class:is-today={isToday} class:is-selected-day={isSelectedDay}>
          {#each slots as slot (slot.start)}
            {@const isSelected = selectedSlot === slot.start}
            <button
              type="button"
              class="week-cell week-cell--{isSelected ? 'selected' : slot.state.toLowerCase()}"
              class:is-start={slot.bookingStart}
              class:is-readonly={readonly}
              title={slot.booking
                ? `${fmtHour(slot.booking.startTime)}–${fmtHour(slot.booking.endTime)} · ${slot.booking.customerName ?? 'Cliente'} · ${slot.booking.serviceName ?? 'Servicio'}`
                : undefined}
              aria-label={`${wd.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })} ${fmtHour(slot.start)} ${stateLabel(isSelected ? 'SELECTED' : slot.state)}${slot.booking ? ` · ${slot.booking.customerName ?? 'Cliente'}` : ''}`}
              disabled={slot.state === 'BOOKED'}
              onclick={() => clickSlot(slot)}
            >
              {#if slot.booking && slot.bookingStart}
                <span class="week-cell__label">
                  <strong>{slot.booking.customerName ?? 'Cliente'}</strong>
                  <span>{slot.booking.serviceName ?? 'Servicio'}</span>
                </span>
              {/if}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style lang="scss">
  /* =============================================================
     DAY VIEW
     ============================================================= */
  .cal--day {
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-lg;
    overflow: hidden;
  }

  .day-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
    padding: $space-4 $space-5;
    background: color.adjust($ivory, $lightness: -2%);
    border-bottom: 1px solid $border;
  }

  .day-header__date {
    font-weight: $fw-semibold;
    color: $text;
    font-size: $fs-md;
    text-transform: capitalize;
  }

  .day-header__today {
    font-size: $fs-xs;
    font-weight: $fw-medium;
    letter-spacing: $ls-wide;
    text-transform: uppercase;
    color: $plum;
    background: $plum-soft;
    padding: 2px 10px;
    border-radius: $radius-pill;
  }

  .day-grid {
    display: grid;
    grid-template-columns: 56px 1fr;
    position: relative;
  }

  .day-time-col {
    border-right: 1px solid $border;
    background: $ivory;
  }

  .day-time-cell {
    height: 44px;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 4px 8px 0 0;
  }

  .day-time-label {
    font-size: $fs-xs;
    color: $muted;
    font-variant-numeric: tabular-nums;
    transform: translateY(-6px);
    background: $surface;
    padding: 0 2px;
  }

  .day-slots-col {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .day-slot {
    appearance: none;
    border: 0;
    background: transparent;
    border-top: 1px solid color.adjust($border, $lightness: -3%);
    border-bottom: 1px solid color.adjust($border, $lightness: -3%);
    margin: -1px 0;
    padding: 6px 14px;
    min-height: 44px;
    text-align: left;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    color: $text;
    font-family: inherit;
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out);

    &:hover:not(:disabled) {
      background: color.adjust($plum-soft, $lightness: 4%);
    }

    &.is-hour-mark {
      border-top-color: $border;
    }

    &.is-selected {
      background: $plum-soft;
      box-shadow: inset 3px 0 0 $plum;
    }

    &.is-booked {
      cursor: not-allowed;
      background: rgba(63, 81, 181, 0.06);
    }

    &.is-out {
      background: repeating-linear-gradient(
        135deg,
        transparent 0 6px,
        rgba(0, 0, 0, 0.035) 6px 12px
      );
      cursor: default;
    }

    &.is-readonly:not(.is-booked) {
      cursor: default;
    }

    &:disabled {
      opacity: 0.7;
    }
  }

  .day-slot__time {
    font-size: $fs-xs;
    color: $muted;
    font-variant-numeric: tabular-nums;
  }

  .day-slot__hint {
    font-size: $fs-xs;
    color: color.adjust($muted, $lightness: 15%);
  }

  .day-slot__bar {
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 3px;
    background: $plum;
    border-radius: 0 2px 2px 0;
  }

  .day-slot__customer {
    font-size: $fs-sm;
    font-weight: $fw-medium;
    color: $text;
  }

  .day-slot__service {
    font-size: $fs-xs;
    color: $muted;
  }

  .now-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: $danger;
    z-index: 5;
    pointer-events: none;
  }

  .now-line__dot {
    position: absolute;
    left: -4px;
    top: -3px;
    width: 8px;
    height: 8px;
    background: $danger;
    border-radius: 50%;
  }

  /* =============================================================
     WEEK VIEW
     ============================================================= */
  .cal--week {
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-lg;
    overflow: hidden;
  }

  .week-header {
    display: grid;
    grid-template-columns: 56px repeat(5, 1fr);
    background: color.adjust($ivory, $lightness: -2%);
    border-bottom: 1px solid $border;
  }

  .week-header__time-spacer {
    border-right: 1px solid $border;
  }

  .week-header__day {
    padding: $space-3 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    color: $muted;
    border-left: 1px solid $border;

    &.is-today {
      color: $plum;
    }

    &.is-selected-day {
      background: $plum-soft;
    }
  }

  .week-header__dow {
    font-size: $fs-xs;
    text-transform: uppercase;
    letter-spacing: $ls-wide;
  }

  .week-header__num {
    font-size: $fs-md;
    font-weight: $fw-semibold;
    color: inherit;
  }

  .week-grid {
    display: grid;
    grid-template-columns: 56px repeat(5, 1fr);
  }

  .week-col {
    display: flex;
    flex-direction: column;
    border-left: 1px solid $border;

    &.is-today {
      background: rgba(63, 81, 181, 0.03);
    }

    &.is-selected-day {
      box-shadow: inset 2px 0 0 $plum, inset -2px 0 0 $plum;
    }
  }

  .week-col--time {
    background: $ivory;
    border-left: 0;
    border-right: 1px solid $border;
  }

  .week-time {
    flex: 1;
    min-height: 28px;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 2px 8px 0 0;
    border-top: 1px solid color.adjust($border, $lightness: -3%);

    span {
      font-size: $fs-xs;
      color: $muted;
      transform: translateY(-6px);
      background: $ivory;
      padding: 0 2px;
    }
  }

  .week-cell {
    flex: 1;
    min-height: 28px;
    appearance: none;
    border: 0;
    background: transparent;
    border-top: 1px solid color.adjust($border, $lightness: -3%);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out);
    position: relative;

    &:hover:not(:disabled) {
      background: color.adjust($plum-soft, $lightness: 4%);
    }

    &.week-cell--booked {
      cursor: default;
      background: rgba(63, 81, 181, 0.16);
      color: $text;
      opacity: 1;

      &:hover {
        background: rgba(63, 81, 181, 0.16);
      }

      // Las franjas de continuación se funden con la de inicio: se ve una sola reserva.
      &:not(.is-start) {
        border-top-color: transparent;
      }

      &.is-start {
        box-shadow: inset 3px 0 0 $plum;
      }
    }

    &.week-cell--out_of_hours {
      cursor: default;
      background: repeating-linear-gradient(
        135deg,
        transparent 0 6px,
        rgba(0, 0, 0, 0.04) 6px 12px
      );
    }

    &.week-cell--available.is-readonly {
      cursor: default;
    }

    &.week-cell--selected {
      background: $plum-soft;
      box-shadow: inset 0 0 0 2px $plum;
    }
  }

  .week-cell__label {
    position: absolute;
    inset: 1px 4px 0 8px;
    display: flex;
    align-items: baseline;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
    text-align: left;
    font-size: $fs-xs;
    line-height: 1.2;
    z-index: 1;

    strong {
      font-weight: $fw-semibold;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    span {
      color: $muted;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  /* Alto ajustado a la pantalla: las filas se reparten el espacio en vez de crecer. */
  .cal--fit {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;

    .week-grid {
      flex: 1;
      min-height: 0;
    }

    .week-cell,
    .week-time {
      min-height: 0;
    }
  }
</style>