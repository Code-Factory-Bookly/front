import { apiFetch } from './api';
import type { RoleAssignment, RoleAssignmentInput, UserSearchResult } from '$lib/types/roles';

export const roleService = {
  search(query: string): Promise<UserSearchResult[]> {
    return apiFetch<UserSearchResult[]>(`/usuarios/buscar?q=${encodeURIComponent(query)}`);
  },
  assign(userId: string, input: RoleAssignmentInput): Promise<RoleAssignment> {
    return apiFetch<RoleAssignment>(`/usuarios/${userId}/rol`, {
      method: 'PUT',
      json: input
    });
  }
};
