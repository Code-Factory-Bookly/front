<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Button from '$lib/components/Button.svelte';
  import { auditService } from '$lib/services/audit';
  import { serviceService } from '$lib/services/service';
  import { professionalService } from '$lib/services/professional';
  import { toasts } from '$lib/stores/toasts';
  import { onMount } from 'svelte';
  import type { AuditActionType, AuditLogEntry, AuditLogPage } from '$lib/types/audit';
  import { ChevronLeft, ChevronRight, RefreshCw, ShieldCheck } from 'lucide-svelte';

  const RANGES = [
    { value: 1, label: 'Últimas 24 h' },
    { value: 7, label: 'Últimos 7 días' },
    { value: 30, label: 'Últimos 30 días' }
  ];

  const ACTIONS: { value: 'ALL' | AuditActionType; label: string }[] = [
    { value: 'ALL', label: 'Todas' },
    { value: 'BOOKING_CREATED', label: 'Reservas creadas' },
    { value: 'BOOKING_CANCELLED', label: 'Reservas canceladas' },
    { value: 'ROLE_CHANGED', label: 'Cambios de rol' },
    { value: 'REPORT_VIEWED', label: 'Consultas de reportes' }
  ];

  const REPORT_LABELS: Record<string, string> = {
    'HU-15': 'Reporte de ocupación',
    'HU-16': 'Reporte general'
  };

  const PERIOD_LABELS: Record<string, string> = {
    SEMANA: 'últimos 7 días',
    MES: 'últimos 30 días'
  };

  const RESOURCE_LABELS: Record<string, string> = {
    BOOKING: 'Reserva',
    USER: 'Usuario',
    REPORT: 'Reporte'
  };

  const ROLE_LABELS: Record<string, string> = {
    CUSTOMER: 'Cliente',
    PROFESSIONAL: 'Profesional',
    ADMIN: 'Administrador'
  };

  let rangeDays = $state(7);
  let actionFilter = $state<'ALL' | AuditActionType>('ALL');
  let page = $state(0);
  let result = $state<AuditLogPage | null>(null);
  let loading = $state(true);

  const serviceNames = new Map<string, string>();
  const professionalNames = new Map<string, string>();
  let namesVersion = $state(0);

  async function loadNames() {
    try {
      const [services, professionals] = await Promise.all([serviceService.list(), professionalService.list()]);
      services.forEach((s) => serviceNames.set(s.id, s.name));
      professionals.forEach((p) => professionalNames.set(p.id, p.fullName));
      namesVersion++;
    } catch {
      // Sin nombres la bitácora sigue siendo útil: se muestran los datos crudos.
    }
  }

  async function load() {
    loading = true;
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    try {
      result = await auditService.find({ from: from.toISOString(), to: to.toISOString(), page, size: 50 });
    } catch (err) {
      result = null;
      const msg = (err as { message?: string })?.message ?? 'No se pudo cargar la bitácora.';
      toasts.push(msg, 'danger');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadNames();
    void load();
  });

  function changeRange(days: number) {
    rangeDays = days;
    page = 0;
    void load();
  }

  function goToPage(next: number) {
    page = next;
    void load();
  }

  const entries = $derived(
    (result?.content ?? []).filter((e) => actionFilter === 'ALL' || e.actionType === actionFilter)
  );

  function actionLabel(type: AuditActionType) {
    if (type === 'BOOKING_CREATED') return 'Reserva creada';
    if (type === 'BOOKING_CANCELLED') return 'Reserva cancelada';
    if (type === 'REPORT_VIEWED') return 'Consulta de reporte';
    if (type === 'CUSTOMER_HISTORY_VIEWED') return 'Consulta de historial';
    return 'Cambio de rol';
  }

  function fmtDay(iso: string) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  function fmtDateTime(iso: string) {
    return new Date(iso).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function describe(entry: AuditLogEntry): string {
    void namesVersion;
    const m = entry.metadata ?? {};
    if (entry.actionType === 'ROLE_CHANGED') {
      const prev = ROLE_LABELS[m.previousRole] ?? m.previousRole;
      const next = ROLE_LABELS[m.newRole] ?? m.newRole;
      return `${prev} → ${next}`;
    }
    if (entry.actionType === 'REPORT_VIEWED') {
      const report = REPORT_LABELS[m.report] ?? 'Reporte';
      const period = m.period ? PERIOD_LABELS[m.period] ?? m.period : 'rango propio';
      const range = m.from && m.to ? `${fmtDay(m.from)} – ${fmtDay(m.to)}` : null;
      return [report, period, range].filter(Boolean).join(' · ');
    }
    if (entry.actionType === 'CUSTOMER_HISTORY_VIEWED') {
      return 'Historial de reservas de un cliente';
    }
    const service = (m.serviceId && serviceNames.get(m.serviceId)) || 'Servicio';
    const professional = m.professionalId ? professionalNames.get(m.professionalId) : undefined;
    const when = m.startTime ? fmtDateTime(m.startTime) : '';
    const base = [service, professional ? `con ${professional}` : null, when].filter(Boolean).join(' · ');
    return m.cancellationReason ? `${base} · Motivo: ${m.cancellationReason}` : base;
  }

  function shortId(id: string | null) {
    return id ? id.slice(0, 8) : '—';
  }
</script>

<svelte:head>
  <title>Auditoría · BOOKLY Administración</title>
</svelte:head>

<PageHead
  eyebrow="Seguridad"
  title="Auditoría."
  description="Registro de las acciones críticas de la plataforma: reservas creadas y canceladas, cambios de rol y consultas de información sensible."
>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => load()}>
      <RefreshCw size={16} /> Actualizar
    </Button>
  {/snippet}
</PageHead>

<div class="filters">
  <div class="chips" role="group" aria-label="Periodo">
    {#each RANGES as r (r.value)}
      <button type="button" class="chip" class:is-active={rangeDays === r.value} onclick={() => changeRange(r.value)}>
        {r.label}
      </button>
    {/each}
  </div>
  <div class="chips" role="group" aria-label="Tipo de acción">
    {#each ACTIONS as a (a.value)}
      <button type="button" class="chip" class:is-active={actionFilter === a.value} onclick={() => (actionFilter = a.value)}>
        {a.label}
      </button>
    {/each}
  </div>
</div>

<p class="immutable">
  <ShieldCheck size={14} /> Los registros son inmutables: la base de datos impide editarlos o borrarlos.
</p>

<section class="audit" data-od-id="admin-audit">
  {#if loading}
    <Skeleton lines={6} />
  {:else if entries.length === 0}
    <EmptyState title="Sin registros en este periodo" description="Prueba con un periodo más amplio u otro tipo de acción." />
  {:else}
    <ul class="audit__list">
      {#each entries as e (e.id)}
        <li class="entry">
          <span class="entry__badge entry__badge--{e.actionType.toLowerCase()}">{actionLabel(e.actionType)}</span>
          <div class="entry__main">
            <p class="entry__detail">{describe(e)}</p>
            <p class="entry__meta">
              {e.actorName ?? 'Cuenta eliminada'}{e.actorEmail ? ` · ${e.actorEmail}` : ''}
              · {RESOURCE_LABELS[e.resourceType] ?? e.resourceType} {shortId(e.resourceId)}
              {#if e.sourceIp}· IP {e.sourceIp}{/if}
            </p>
          </div>
          <time class="entry__time" datetime={e.occurredAt}>{fmtDateTime(e.occurredAt)}</time>
        </li>
      {/each}
    </ul>

    {#if result && result.totalPages > 1}
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
    margin-bottom: $space-4;
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

  .immutable {
    display: flex;
    align-items: center;
    gap: $space-2;
    font-size: $fs-xs;
    color: $muted;
    margin-bottom: $space-4;
  }

  .audit__list {
    list-style: none;
    margin: 0;
    padding: 0;
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-lg;
    overflow: hidden;
  }

  .entry {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: $space-4;
    align-items: center;
    padding: $space-4 $space-5;
    border-top: 1px solid $border;

    &:first-child {
      border-top: 0;
    }

    @media (max-width: #{$bp-md}) {
      grid-template-columns: 1fr;
      gap: $space-2;
    }
  }

  .entry__badge {
    font-size: $fs-xs;
    font-weight: $fw-medium;
    padding: 4px 10px;
    border-radius: $radius-pill;
    white-space: nowrap;
    justify-self: start;
  }

  .entry__badge--booking_created {
    color: color.adjust($success, $lightness: -8%);
    background: rgba(94, 159, 122, 0.12);
  }

  .entry__badge--booking_cancelled {
    color: $danger;
    background: rgba(200, 80, 80, 0.1);
  }

  .entry__badge--role_changed,
  .entry__badge--customer_history_viewed {
    color: $plum;
    background: $plum-soft;
  }

  .entry__badge--report_viewed {
    color: color.adjust($plum, $lightness: 10%);
    background: rgba(58, 42, 82, 0.06);
    border: 1px solid $border;
  }

  .entry__main {
    min-width: 0;
  }

  .entry__detail {
    font-weight: $fw-medium;
    color: $text;
  }

  .entry__meta {
    font-size: $fs-sm;
    color: $muted;
    margin-top: 2px;
    overflow-wrap: anywhere;
  }

  .entry__time {
    font-size: $fs-sm;
    color: $muted;
    white-space: nowrap;
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
