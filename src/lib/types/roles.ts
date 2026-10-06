import type { UserRole } from '$lib/types/auth';

export interface RoleAssignmentInput {
  role: UserRole;
  specialty?: string;
}

export interface RoleAssignment {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}
