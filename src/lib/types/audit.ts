export type AuditActionType = 'BOOKING_CREATED' | 'BOOKING_CANCELLED' | 'ROLE_CHANGED';
export type AuditResourceType = 'BOOKING' | 'USER';

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorName: string | null;
  actorEmail: string | null;
  actionType: AuditActionType;
  resourceType: AuditResourceType;
  resourceId: string | null;
  occurredAt: string;
  sourceIp: string | null;
  metadata: Record<string, string>;
}

export interface AuditLogPage {
  content: AuditLogEntry[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
