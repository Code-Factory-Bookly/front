import { apiFetch } from './api';
import { serviceService } from './service';
import type {
  Booking,
  BookingHistoryPage,
  BookingNotifications,
  BookingStatus,
  CancelBookingResult,
  ProfessionalAgenda
} from '$lib/types/booking';

// El catálogo es público y pequeño; cachear por id evita pedirlo de nuevo en cada recarga.
const serviceNameCache = new Map<string, string>();

async function withServiceNames(bookings: Booking[]): Promise<Booking[]> {
  const missing = [
    ...new Set(bookings.filter((b) => !b.serviceName).map((b) => b.serviceId))
  ].filter((id) => !serviceNameCache.has(id));
  await Promise.all(
    missing.map(async (id) => {
      try {
        const service = await serviceService.get(id);
        serviceNameCache.set(id, service.name);
      } catch {
        serviceNameCache.set(id, 'Servicio');
      }
    })
  );
  return bookings.map((b) => ({
    ...b,
    serviceName: b.serviceName ?? serviceNameCache.get(b.serviceId) ?? 'Servicio'
  }));
}

export interface CreateBookingInput {
  professionalId: string;
  serviceId: string;
  startTime: string; // ISO sin zona, ej. 2026-10-20T10:00:00
  endTime: string;
}

export interface HistoryQuery {
  from?: string; // ISO sin zona
  to?: string;
  status?: BookingStatus;
  page?: number;
  size?: number;
  order?: 'asc' | 'desc';
}

export const bookingService = {
  // HU-13: el cliente sale del token, no se envía su id.
  async history(query: HistoryQuery = {}): Promise<BookingHistoryPage> {
    const params = new URLSearchParams();
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.status) params.set('status', query.status);
    params.set('page', String(query.page ?? 0));
    params.set('size', String(query.size ?? 10));
    params.set('order', query.order ?? 'desc');
    const result = await apiFetch<BookingHistoryPage>(`/reservas/cliente/historial?${params.toString()}`);
    return { ...result, content: await withServiceNames(result.content) };
  },

  // HU-14: agenda del profesional autenticado entre dos fechas (máximo 31 días, sin canceladas).
  professionalAgenda(from: string, to: string): Promise<ProfessionalAgenda> {
    const params = new URLSearchParams({ from, to });
    return apiFetch<ProfessionalAgenda>(`/reservas/profesional/agenda?${params.toString()}`);
  },

  async listByProfessional(professionalId: string): Promise<Booking[]> {
    const bookings = await apiFetch<Booking[]>(`/reservas/profesional/${professionalId}`);
    return withServiceNames(bookings);
  },

  async listByCustomer(customerId: string): Promise<Booking[]> {
    const bookings = await apiFetch<Booking[]>(`/reservas/cliente/${customerId}`);
    return withServiceNames(bookings);
  },

  create(input: CreateBookingInput): Promise<Booking> {
    return apiFetch<Booking>('/reservas', {
      method: 'POST',
      json: input
    });
  },

  // HU-09: el backend rechaza cancelaciones con menos de la antelación mínima configurada.
  cancel(bookingId: string, reason?: string): Promise<CancelBookingResult> {
    return apiFetch<CancelBookingResult>(`/reservas/${bookingId}/cancelacion`, {
      method: 'PATCH',
      json: reason ? { reason } : {}
    });
  },

  // HU-10: registro de correos de la reserva (confirmación, cancelación).
  notifications(bookingId: string): Promise<BookingNotifications> {
    return apiFetch<BookingNotifications>(`/reservas/${bookingId}/notificaciones`);
  }
};
