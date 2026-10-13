export interface AvailabilitySlot {
  startTime: string; // ISO, sin zona (LocalDateTime del backend)
  endTime: string;
}

export interface AvailabilityDay {
  date: string; // YYYY-MM-DD
  slots: AvailabilitySlot[];
}

export interface AvailabilityQuery {
  professionalId: string;
  serviceId: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export interface AvailabilityResponse {
  professionalId: string;
  serviceId: string;
  durationMinutes: number;
  from: string;
  to: string;
  available: boolean;
  message: string | null;
  days: AvailabilityDay[];
}
