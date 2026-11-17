import { apiFetch } from './api';
import type { AgendaBlock, AgendaBlockInput, Schedule, ScheduleSlot } from '$lib/types/schedule';

export const scheduleService = {
  get(professionalId: string): Promise<Schedule> {
    return apiFetch<Schedule>(`/horarios/${professionalId}`);
  },

  replace(professionalId: string, slots: ScheduleSlot[]): Promise<Schedule> {
    return apiFetch<Schedule>(`/horarios/${professionalId}`, {
      method: 'PUT',
      json: { slots }
    });
  },

  // HU-05: bloqueos vigentes o futuros del profesional.
  listBlocks(professionalId: string): Promise<AgendaBlock[]> {
    return apiFetch<AgendaBlock[]>(`/horarios/${professionalId}/bloqueos`);
  },

  // Si hay reservas confirmadas en el rango responde 409 AGENDA_BLOCK_HAS_BOOKINGS con las citas en details.
  createBlock(professionalId: string, input: AgendaBlockInput): Promise<AgendaBlock> {
    return apiFetch<AgendaBlock>(`/horarios/${professionalId}/bloqueos`, {
      method: 'POST',
      json: input
    });
  },

  deleteBlock(professionalId: string, blockId: string): Promise<void> {
    return apiFetch<void>(`/horarios/${professionalId}/bloqueos/${blockId}`, { method: 'DELETE' });
  }
};
