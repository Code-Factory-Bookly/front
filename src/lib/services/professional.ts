import { apiFetch } from './api';
import type { Professional, ProfessionalInput, ProfessionalSummary } from '$lib/types/professional';

export const professionalService = {
  list(): Promise<Professional[]> {
    return apiFetch<Professional[]>('/profesionales', { silent401: true });
  },

  create(input: ProfessionalInput): Promise<Professional> {
    return apiFetch<Professional>('/profesionales', {
      method: 'POST',
      json: input
    });
  },

  services(professionalId: string): Promise<string[]> {
    return apiFetch<string[]>(`/profesionales/${professionalId}/servicios`);
  },

  replaceServices(professionalId: string, serviceIds: string[]): Promise<void> {
    return apiFetch<void>(`/profesionales/${professionalId}/servicios`, {
      method: 'PUT',
      json: { serviceIds }
    });
  },

  // Público: HU-08 lo usa para que el cliente elija quién le atiende antes de reservar.
  forService(serviceId: string): Promise<ProfessionalSummary[]> {
    return apiFetch<ProfessionalSummary[]>(`/servicios/${serviceId}/profesionales`);
  }
};