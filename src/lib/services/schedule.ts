import { apiFetch } from './api';
import type { Schedule, ScheduleSlot } from '$lib/types/schedule';

export const scheduleService = {
  get(professionalId: string): Promise<Schedule> {
    return apiFetch<Schedule>(`/horarios/${professionalId}`);
  },

  replace(professionalId: string, slots: ScheduleSlot[]): Promise<Schedule> {
    return apiFetch<Schedule>(`/horarios/${professionalId}`, {
      method: 'PUT',
      json: { slots }
    });
  }
};
