import { apiFetch } from './api';
import { serviceService } from './service';
import type { Booking } from '$lib/types/booking';

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

export const bookingService = {
  async listByProfessional(professionalId: string): Promise<Booking[]> {
    const bookings = await apiFetch<Booking[]>(`/reservas/profesional/${professionalId}`);
    return withServiceNames(bookings);
  },

  async listByCustomer(customerId: string): Promise<Booking[]> {
    const bookings = await apiFetch<Booking[]>(`/reservas/cliente/${customerId}`);
    return withServiceNames(bookings);
  }
};
