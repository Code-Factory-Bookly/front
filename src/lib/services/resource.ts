import { apiFetch } from './api';
import type { PhysicalResource, PhysicalResourceInput } from '$lib/types/resource';

export const resourceService = {
  list(): Promise<PhysicalResource[]> {
    return apiFetch<PhysicalResource[]>('/recursos');
  },

  create(input: PhysicalResourceInput): Promise<PhysicalResource> {
    return apiFetch<PhysicalResource>('/recursos', { method: 'POST', json: input });
  },

  update(id: string, input: PhysicalResourceInput): Promise<PhysicalResource> {
    return apiFetch<PhysicalResource>(`/recursos/${id}`, { method: 'PUT', json: input });
  },

  // Ids de los recursos que necesita un servicio (HU-11); HU-12 los usa al validar la reserva.
  resourcesOfService(serviceId: string): Promise<string[]> {
    return apiFetch<string[]>(`/recursos/asignaciones/servicios/${serviceId}`);
  },

  assign(serviceId: string, resourceId: string): Promise<void> {
    return apiFetch<void>(`/recursos/asignaciones/servicios/${serviceId}/recursos/${resourceId}`, {
      method: 'POST'
    });
  },

  unassign(serviceId: string, resourceId: string): Promise<void> {
    return apiFetch<void>(`/recursos/asignaciones/servicios/${serviceId}/recursos/${resourceId}`, {
      method: 'DELETE'
    });
  }
};
