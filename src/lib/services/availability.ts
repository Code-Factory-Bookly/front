import { apiFetch } from './api';
import type { AvailabilityQuery, AvailabilityResponse } from '$lib/types/availability';

export const availabilityService = {
  find(query: AvailabilityQuery): Promise<AvailabilityResponse> {
    const params = new URLSearchParams({
      profesionalId: query.professionalId,
      servicioId: query.serviceId,
      desde: query.from,
      hasta: query.to
    });
    return apiFetch<AvailabilityResponse>(`/disponibilidad?${params.toString()}`);
  }
};
