<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Button from '$lib/components/Button.svelte';
  import Money from '$lib/components/Money.svelte';
  import { reportService, type OccupancyQuery } from '$lib/services/report';
  import { toasts } from '$lib/stores/toasts';
  import { onMount } from 'svelte';
  import type { DayOfWeek, GeneralReport, OccupancyReport, ReportPeriod } from '$lib/types/report';
  import { RefreshCw, ShieldAlert } from 'lucide-svelte';

  type Mode = ReportPeriod | 'RANGO';

  const MODES: { value: Mode; label: string }[] = [
    { value: 'SEMANA', label: 'Últimos 7 días' },
    { value: 'MES', label: 'Últimos 30 días' },
    { value: 'RANGO', label: 'Rango propio' }
  ];

  const DAYS: Record<DayOfWeek, string> = {
    MONDAY: 'Lunes',
    TUESDAY: 'Martes',
    WEDNESDAY: 'Miércoles',
    THURSDAY: 'Jueves',
    FRIDAY: 'Viernes',
    SATURDAY: 'Sábado',
    SUNDAY: 'Domingo'
  };

  function isoDate(d: Date) {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

  const today = new Date();
  let mode = $state<Mode>('MES');
  let from = $state(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  let to = $state(isoDate(today));
  let rangeError = $state<string | null>(null);

  let occupancy = $state<OccupancyReport | null>(null);
  let occupancyLoading = $state(true);

  let general = $state<GeneralReport | null>(null);
  let generalLoading = $state(true);
  let generalBlocked = $state(false);

  function errorMessage(err: unknown, fallback: string) {
    const e = err as { status?: number; message?: string; details?: Record<string, string> };
    const detail = e?.status === 400 && e.details ? Object.values(e.details)[0] : undefined;
    return detail ?? e?.message ?? fallback;
  }

  async function loadOccupancy() {
    let query: OccupancyQuery;
    if (mode === 'RANGO') {
      if (!from || !to) {
        rangeError = 'Indica las dos fechas.';
        return;
      }
      if (to < from) {
        rangeError = 'La fecha final no puede ser anterior a la inicial.';
        return;
      }
      query = { from, to };
    } else {
      query = { period: mode };
    }
    rangeError = null;
    occupancyLoading = true;
    try {
      occupancy = await reportService.occupancy(query);
    } catch (err) {
      occupancy = null;
      const msg = errorMessage(err, 'No se pudo generar el reporte de ocupación.');
      if (mode === 'RANGO') rangeError = msg;
      else toasts.push(msg, 'danger');
    } finally {
      occupancyLoading = false;
    }
  }

  // El reporte general solo acepta semana o mes; con un rango propio se muestra el mes.
  async function loadGeneral() {
    generalLoading = true;
    generalBlocked = false;
    try {
      general = await reportService.general(mode === 'SEMANA' ? 'SEMANA' : 'MES');
    } catch (err) {
      general = null;
      if ((err as { status?: number })?.status === 403) generalBlocked = true;
      else toasts.push(errorMessage(err, 'No se pudo generar el reporte general.'), 'danger');
    } finally {
      generalLoading = false;
    }
  }

  function refresh() {
    void loadOccupancy();
    void loadGeneral();
  }

  function changeMode(next: Mode) {
    mode = next;
    if (next !== 'RANGO') refresh();
  }

  onMount(refresh);

  function pct(value: number | null) {
    if (value === null) return 'No calculable';
    return `${value.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`;
  }

  function hours(minutes: number) {
    const h = minutes / 60;
    return `${h.toLocaleString('es-CO', { maximumFractionDigits: 1 })} h`;
  }

  function fmtDate(iso: string) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // La barra se recorta visualmente a 100 %, pero el número muestra el valor real (puede superarlo).
  function barWidth(value: number | null) {
    return `${Math.min(100, Math.max(0, value ?? 0))}%`;
  }

  const hasCapacity = $derived(
    !!occupancy && occupancy.byDayOfWeek.some((d) => d.capacityMinutes > 0 || d.bookedMinutes > 0)
  );
</script>

<svelte:head>
  <title>Reportes · BOOKLY Administración</title>
</svelte:head>

<PageHead
  eyebrow="Análisis"
  title="Reportes."
  description="Ocupación de las agendas y uso general de la plataforma en el periodo elegido."
>
  {#snippet actions()}
    <Button variant="ghost" onclick={refresh}>
      <RefreshCw size={16} /> Actualizar
    </Button>
  {/snippet}
</PageHead>

<div class="filters">
  <div class="chips" role="group" aria-label="Periodo">
    {#each MODES as m (m.value)}
      <button type="button" class="chip" class:is-active={mode === m.value} onclick={() => changeMode(m.value)}>
        {m.label}
      </button>
    {/each}
  </div>
  {#if mode === 'RANGO'}
    <form
      class="range"
      onsubmit={(e) => {
        e.preventDefault();
        refresh();
      }}
    >
      <label class="range__field">
        <span>Desde</span>
        <input type="date" bind:value={from} max={to} />
      </label>
      <label class="range__field">
        <span>Hasta</span>
        <input type="date" bind:value={to} min={from} />
      </label>
      <Button type="submit" size="sm">Consultar</Button>
    </form>
    {#if rangeError}<p class="range__error" role="alert">{rangeError}</p>{/if}
  {/if}
</div>

<section class="card" data-od-id="report-occupancy">
  <header class="card__head">
    <div>
      <h2 class="card__title">Ocupación de las agendas</h2>
      {#if occupancy}
        <p class="card__hint">{fmtDate(occupancy.from)} – {fmtDate(occupancy.to)} · minutos reservados sobre minutos de horario; los bloqueos de agenda se descuentan de la capacidad.</p>
      {/if}
    </div>
    {#if occupancy && !occupancyLoading}
      <div class="kpi">
        <span class="kpi__value">{pct(occupancy.overallOccupancyPercent)}</span>
        <span class="kpi__label">ocupación general</span>
      </div>
    {/if}
  </header>

  {#if occupancyLoading}
    <Skeleton lines={6} />
  {:else if !occupancy}
    <EmptyState title="Sin datos" description="No se pudo generar el reporte para este periodo." />
  {:else if !hasCapacity}
    <EmptyState title="Sin horarios ni reservas" description="Ningún profesional tiene horario o reservas en este periodo." />
  {:else}
    <div class="split">
      <div>
        <h3 class="sub">Por día de la semana</h3>
        <ul class="bars">
          {#each occupancy.byDayOfWeek as d (d.dayOfWeek)}
            <li class="bar">
              <span class="bar__label">{DAYS[d.dayOfWeek]}</span>
              <span class="bar__track" aria-hidden="true">
                <span class="bar__fill" class:is-over={(d.occupancyPercent ?? 0) > 100} style:width={barWidth(d.occupancyPercent)}></span>
              </span>
              <span class="bar__value">{pct(d.occupancyPercent)}</span>
            </li>
          {/each}
        </ul>
      </div>
      <div>
        <h3 class="sub">Por profesional</h3>
        <table class="table">
          <thead>
            <tr><th>Profesional</th><th>Reservado</th><th>Capacidad</th><th>Ocupación</th></tr>
          </thead>
          <tbody>
            {#each occupancy.byProfessional as p (p.professionalId)}
              <tr>
                <td>{p.professionalName}</td>
                <td>{hours(p.bookedMinutes)}</td>
                <td>{hours(p.capacityMinutes)}</td>
                <td class="table__pct">{pct(p.occupancyPercent)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</section>

<section class="card" data-od-id="report-general">
  <header class="card__head">
    <div>
      <h2 class="card__title">Uso de la plataforma</h2>
      {#if general}
        <p class="card__hint">{fmtDate(general.from)} – {fmtDate(general.to)}{mode === 'RANGO' ? ' · este reporte usa los últimos 30 días' : ''}</p>
      {/if}
    </div>
  </header>

  {#if generalLoading}
    <Skeleton lines={4} />
  {:else if generalBlocked}
    <div class="notice">
      <ShieldAlert size={18} />
      <p>Este reporte contiene ingresos y solo se muestra en una sesión de administrador verificada con MFA. Cierra sesión y vuelve a entrar con tu código.</p>
    </div>
  {:else if general}
    <div class="stats">
      <div class="stat">
        <span class="stat__value">{general.totalReservations}</span>
        <span class="stat__label">reservas</span>
      </div>
      <div class="stat">
        <span class="stat__value">{general.cancelledReservations}</span>
        <span class="stat__label">canceladas</span>
      </div>
      <div class="stat">
        <span class="stat__value">{general.averageCancellationsPerDay.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</span>
        <span class="stat__label">cancelaciones por día</span>
      </div>
      <div class="stat">
        <span class="stat__value"><Money value={general.recognizedRevenue} /></span>
        <span class="stat__label">ingresos reconocidos</span>
      </div>
    </div>

    {#if general.resourceUsage.length > 0}
      <h3 class="sub">Uso de recursos físicos</h3>
      <table class="table">
        <thead>
          <tr><th>Recurso</th><th>Inventario</th><th>Reservas que lo usaron</th></tr>
        </thead>
        <tbody>
          {#each general.resourceUsage as r (r.resourceId)}
            <tr>
              <td>{r.resourceName}</td>
              <td>{r.totalQuantity}</td>
              <td>{r.bookingsUsingResource}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if general.message}<p class="card__hint">{general.message}</p>{/if}
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

  .range {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: $space-3;
  }

  .range__field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: $fs-sm;
    color: $muted;

    input {
      font: inherit;
      color: $text;
      background: $surface;
      border: 1px solid $border;
      border-radius: $radius-md;
      padding: 6px 10px;
    }
  }

  .range__error {
    font-size: $fs-sm;
    color: $danger;
  }

  .card {
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-lg;
    padding: $space-5;
    margin-bottom: $space-5;
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }

  .card__head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: $space-4;
  }

  .card__title {
    font-size: $fs-lg;
    font-weight: $fw-medium;
    color: $text;
  }

  .card__hint {
    font-size: $fs-sm;
    color: $muted;
    margin-top: 2px;
  }

  .kpi {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .kpi__value {
    font-size: 2rem;
    font-weight: $fw-medium;
    color: $plum;
    line-height: 1.1;
  }

  .kpi__label,
  .stat__label {
    font-size: $fs-xs;
    color: $muted;
  }

  .split {
    display: grid;
    gap: $space-6;
    grid-template-columns: 1fr;

    @media (min-width: #{$bp-lg}) {
      grid-template-columns: 1fr 1.2fr;
    }
  }

  .sub {
    font-size: $fs-sm;
    font-weight: $fw-medium;
    color: $muted;
    margin-bottom: $space-3;
  }

  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  .bar {
    display: grid;
    grid-template-columns: 84px 1fr 96px;
    align-items: center;
    gap: $space-3;
    font-size: $fs-sm;
  }

  .bar__label {
    color: $text;
  }

  .bar__track {
    height: 10px;
    background: $plum-soft;
    border-radius: $radius-pill;
    overflow: hidden;
  }

  .bar__fill {
    display: block;
    height: 100%;
    background: $plum;
    border-radius: $radius-pill;

    &.is-over {
      background: $danger;
    }
  }

  .bar__value {
    text-align: right;
    color: $muted;
    font-variant-numeric: tabular-nums;
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: $fs-sm;

    th {
      text-align: left;
      font-weight: $fw-medium;
      color: $muted;
      padding: $space-2 $space-2 $space-2 0;
      border-bottom: 1px solid $border;
    }

    td {
      padding: $space-2 $space-2 $space-2 0;
      border-bottom: 1px solid $border;
      color: $text;
      font-variant-numeric: tabular-nums;
    }

    tr:last-child td {
      border-bottom: 0;
    }
  }

  .table__pct {
    font-weight: $fw-medium;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: $space-3;

    @media (min-width: #{$bp-md}) {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: $space-4;
    border: 1px solid $border;
    border-radius: $radius-md;
  }

  .stat__value {
    font-size: 1.5rem;
    font-weight: $fw-medium;
    color: $text;
  }

  .notice {
    display: flex;
    gap: $space-3;
    align-items: flex-start;
    padding: $space-4;
    border-radius: $radius-md;
    background: $plum-soft;
    color: $plum;
    font-size: $fs-sm;
  }
</style>
