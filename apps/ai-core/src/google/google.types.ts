export type CalendarEvent = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  allDay: boolean;
  location?: string;
  hangoutLink?: string;
  attendees: string[];
  organizer?: string;
  status?: string;
  description?: string;
};

export type CreateCalendarEventInput = {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
  timeZone?: string;
};

export type UpdateCalendarEventInput = {
  start?: string;
  end?: string;
  attendees?: string[];
  timeZone?: string;
  /** Whether Calendar should email attendees about the change. Defaults to true. */
  notifyAttendee?: boolean;
};

export type GmailThreadSummary = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date?: string;
  labelIds: string[];
};

export type GmailMessage = GmailThreadSummary & {
  cc?: string;
  body: string;
  /** Raw text/html part with inline (cid:) images resolved to data URIs, when present. */
  bodyHtml?: string;
  messageIdHeader?: string;
};

export type SendOrDraftInput = {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  cc?: string;
};

export type GoogleNotConnected = {
  connected: false;
  reason: "not_connected" | "missing_oauth_config";
};

export type GoogleResult<T> = ({ connected: true } & T) | GoogleNotConnected;
