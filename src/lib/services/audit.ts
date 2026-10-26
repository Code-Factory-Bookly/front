import { apiFetch } from './api';
import type { AuditLogPage } from '$lib/types/audit';

export interface AuditQuery {
  from: string; // ISO con zona
  to: string;
  page?: number;
  size?: number;
}

export const auditService = {
  find(query: AuditQuery): Promise<AuditLogPage> {
    const params = new URLSearchParams({
      from: query.from,
      to: query.to,
      page: String(query.page ?? 0),
      size: String(query.size ?? 50)
    });
    return apiFetch<AuditLogPage>(`/auditoria?${params.toString()}`);
  }
};
