export type CalComNotConnected = { connected: false; reason: "not_connected" | "api_error" };
export type CalComResult<T> = ({ connected: true } & T) | CalComNotConnected;

export type CalComEventType = {
  id: number;
  slug: string;
  title: string;
  description?: string;
  length: number;
  hidden: boolean;
  bookingLink: string;
};

export type CalComBooking = {
  id: number;
  uid: string;
  title: string;
  description?: string;
  status: "ACCEPTED" | "PENDING" | "CANCELLED" | "REJECTED";
  start: string;
  end: string;
  duration: number;
  attendees: Array<{ name: string; email: string; timeZone?: string }>;
  meetingUrl?: string;
  eventType?: { id: number; slug: string; title: string };
  location?: string;
};

export type CalComSlot = {
  start: string;
  end: string;
};

export type CalComSlotsResult = {
  slots: Record<string, CalComSlot[]>;
};

export type CreateBookingInput = {
  eventTypeId: number;
  start: string;
  attendee: { name: string; email: string; timeZone?: string };
  guests?: string[];
  notes?: string;
  metadata?: Record<string, string>;
};

export type CancelBookingInput = {
  bookingUid: string;
  reason?: string;
};

export type RescheduleBookingInput = {
  bookingUid: string;
  start: string;
  reason?: string;
};
