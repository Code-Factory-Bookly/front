import { apiFetch } from './api';
import type { RoleAssignment, RoleAssignmentInput } from '$lib/types/roles';

export const roleService = {
  assign(userId: string, input: RoleAssignmentInput): Promise<RoleAssignment> {
    return apiFetch<RoleAssignment>(`/usuarios/${userId}/rol`, {
      method: 'PUT',
      json: input
    });
  }
};
