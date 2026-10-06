import { apiFetch } from './api';
import type { Professional, ProfessionalInput } from '$lib/types/professional';

export const professionalService = {
  list(): Promise<Professional[]> {
    return apiFetch<Professional[]>('/profesionales', { silent401: true });
  },

  create(input: ProfessionalInput): Promise<Professional> {
    return apiFetch<Professional>('/profesionales', {
      method: 'POST',
      json: input
    });
  }
};