export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface ScheduleSlot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface Schedule {
  professionalId: string;
  slots: ScheduleSlot[];
}

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo'
};

// HU-05: bloqueo temporal de agenda (vacaciones, imprevistos). Rango [startTime, endTime).
export interface AgendaBlock {
  id: string;
  professionalId: string;
  startTime: string; // ISO local, ej. 2026-12-21T08:00:00
  endTime: string;
  reason: string | null;
  createdAt: string;
}

export interface AgendaBlockInput {
  startTime: string;
  endTime: string;
  reason?: string;
}
