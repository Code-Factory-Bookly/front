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
  // El backend los incluye en los listados; serviceName se completa desde el catálogo si falta.
  serviceName?: string;
  customerName?: string;
}

export interface CancelBookingResult {
  bookingId: string;
  status: BookingStatus;
  cancelledAt: string;
  cancellationReason: string | null;
}

export type NotificationEventType = 'BOOKING_CREATED' | 'BOOKING_RESCHEDULED' | 'BOOKING_CANCELLED';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface NotificationDelivery {
  id: string;
  eventType: NotificationEventType;
  recipientEmail: string;
  subject: string;
  status: NotificationStatus;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
  errorMessage: string | null;
}

export interface BookingNotifications {
  // "logging": el correo solo queda registrado en el servidor; "smtp": se envía de verdad.
  deliveryMode: string;
  deliveries: NotificationDelivery[];
}

export type SlotState = 'AVAILABLE' | 'BOOKED' | 'NO_SERVICE' | 'OUT_OF_HOURS' | 'SELECTED';

export interface TimeSlot {
  start: string; // ISO
  end: string; // ISO
  state: SlotState;
  booking?: Booking;
  /** La reserva empieza en esta franja (las siguientes que cubre son solo continuación). */
  bookingStart?: boolean;
}
