export type BookingStatus = 'CONFIRMADA' | 'CANCELADA' | 'RESCHEDULED' | 'COMPLETED';

export interface Booking {
  id: string;
  customerId: string;
  professionalId: string;
  serviceId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  // El backend no los incluye todavía; bookingService los resuelve en el front donde puede.
  serviceName?: string;
  customerName?: string;
}

export type SlotState = 'AVAILABLE' | 'BOOKED' | 'NO_SERVICE' | 'OUT_OF_HOURS' | 'SELECTED';

export interface TimeSlot {
  start: string; // ISO
  end: string; // ISO
  state: SlotState;
  booking?: Booking;
}
