export type ReportPeriod = 'SEMANA' | 'MES';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

// HU-15. Los porcentajes pueden pasar de 100 y son null cuando hay reservas sin capacidad.
export interface OccupancyReport {
  period: ReportPeriod | null;
  from: string;
  to: string;
  overallOccupancyPercent: number | null;
  byDayOfWeek: {
    dayOfWeek: DayOfWeek;
    bookedMinutes: number;
    capacityMinutes: number;
    occupancyPercent: number | null;
  }[];
  byProfessional: {
    professionalId: string;
    professionalName: string;
    bookedMinutes: number;
    capacityMinutes: number;
    occupancyPercent: number | null;
  }[];
}

// HU-16. Requiere una sesión de administrador verificada con MFA.
export interface GeneralReport {
  period: ReportPeriod;
  from: string;
  to: string;
  totalReservations: number;
  cancelledReservations: number;
  averageCancellationsPerDay: number;
  recognizedRevenue: number;
  resourceUsage: {
    resourceId: string;
    resourceName: string;
    totalQuantity: number;
    bookingsUsingResource: number;
  }[];
  message: string | null;
}
