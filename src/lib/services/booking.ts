import { apiFetch } from './api';
import { serviceService } from './service';
import type { Booking, BookingNotifications, CancelBookingResult } from '$lib/types/booking';

// El catálogo es público y pequeño; cachear por id evita pedirlo de nuevo en cada recarga.
const serviceNameCache = new Map<string, string>();

async function withServiceNames(bookings: Booking[]): Promise<Booking[]> {
  const missing = [...new Set(bookings.map((b) => b.serviceId))].filter(
    (id) => !serviceNameCache.has(id)
  );
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
  return bookings.map((b) => ({ ...b, serviceName: serviceNameCache.get(b.serviceId) ?? 'Servicio' }));
}

export interface CreateBookingInput {
  professionalId: string;
  serviceId: string;
  startTime: string; // ISO sin zona, ej. 2026-10-20T10:00:00
  endTime: string;
}

export const bookingService = {
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
