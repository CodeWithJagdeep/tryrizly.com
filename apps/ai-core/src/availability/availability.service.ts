import { Inject, Injectable } from "@nestjs/common";
import { CalComService, type CalComBooking } from "../connectors/calcom.service";
import { ConnectorService } from "../connectors/connector.service";
import { GoogleService } from "../google/google.service";
import type { CalendarEvent } from "../google/google.types";
import { localDateTimeToUtc } from "../lib/timezone";

const MIN = 60_000;
const SLOT_STEP_MINUTES = 30;
const WORKDAY_START_HOUR = 8;
const WORKDAY_END_HOUR = 20;
const SEARCH_DAYS = 7;

export type MeetingSource = "google" | "calcom";

export type BusyWindow = {
  title: string;
  start: string;
  end: string;
  attendees: string[];
  sources: Array<{ provider: MeetingSource; id: string }>;
};

export type AlternativeSlot = {
  start: string;
  end: string;
};

export type AvailabilityCoverageStatus = "connected" | "not_connected" | "error";

export type AvailabilityCheckResult = {
  valid: boolean;
  reason?: string;
  complete: boolean;
  connectedSources: MeetingSource[];
  coverage: Record<MeetingSource, AvailabilityCoverageStatus>;
  conflicts: BusyWindow[];
  alternatives: AlternativeSlot[];
};

type CheckAvailabilityInput = {
  userId: string;
  start: string;
  end: string;
  timezone: string;
  alternativeCount?: number;
  exclude?: {
    googleEventId?: string;
    calComBookingUid?: string;
  };
};

type SourceLoad = {
  status: AvailabilityCoverageStatus;
  windows: BusyWindow[];
};

/**
 * One availability boundary for every scheduling path. Provider records are
 * normalized and mirrored Cal.com/Google meetings are collapsed before either
 * conflict detection or free-slot calculation runs.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(GoogleService)
    private readonly google: GoogleService,
    @Inject(ConnectorService)
    private readonly connectors: ConnectorService,
    @Inject(CalComService)
    private readonly calcom: CalComService,
  ) {}

  async check(input: CheckAvailabilityInput): Promise<AvailabilityCheckResult> {
    const startMs = Date.parse(input.start);
    const endMs = Date.parse(input.end);
    const invalid = invalidWindowReason(startMs, endMs);
    if (invalid) {
      return {
        valid: false,
        reason: invalid,
        complete: true,
        connectedSources: [],
        coverage: { google: "not_connected", calcom: "not_connected" },
        conflicts: [],
        alternatives: [],
      };
    }

    const searchStart = new Date(startMs);
    const searchEnd = searchWindowEnd(searchStart, input.timezone);
    const [google, calcom] = await Promise.all([
      this.loadGoogle(input.userId, searchStart, searchEnd),
      this.loadCalCom(input.userId, searchStart, searchEnd),
    ]);

    const windows = dedupeBusyWindows([...google.windows, ...calcom.windows]).filter(
      (window) => !isExcluded(window, input.exclude),
    );
    const conflicts = windows.filter((window) => overlaps(window, startMs, endMs));
    const alternativeCount = Math.max(0, Math.min(input.alternativeCount ?? 3, 10));
    const alternatives =
      conflicts.length > 0 && alternativeCount > 0
        ? calculateFreeSlots({
            requestedStart: new Date(startMs),
            durationMs: endMs - startMs,
            timezone: input.timezone,
            busy: windows,
            count: alternativeCount,
          })
        : [];
    const coverage = { google: google.status, calcom: calcom.status };

    return {
      valid: true,
      complete: !Object.values(coverage).includes("error"),
      connectedSources: (Object.entries(coverage) as Array<[MeetingSource, AvailabilityCoverageStatus]>)
        .filter(([, status]) => status === "connected")
        .map(([source]) => source),
      coverage,
      conflicts,
      alternatives,
    };
  }

  private async loadGoogle(userId: string, start: Date, end: Date): Promise<SourceLoad> {
    try {
      const result = await this.google.listEvents(userId, {
        timeMin: start,
        timeMax: end,
        maxResults: 200,
      });
      if (!result.connected) {
        const configured = await this.google.isConnected(userId, "calendar").catch(() => false);
        return { status: configured ? "error" : "not_connected", windows: [] };
      }
      return {
        status: "connected",
        windows: result.events.flatMap(calendarEventToWindow),
      };
    } catch {
      return { status: "error", windows: [] };
    }
  }

  private async loadCalCom(userId: string, start: Date, end: Date): Promise<SourceLoad> {
    try {
      const auth = await this.connectors.getCalComSecret(userId);
      if (!auth) {
        const configured = await this.connectors
          .list(userId)
          .then((accounts) => accounts.some(
            (account) => account.provider === "calcom" && account.status === "connected",
          ))
          .catch(() => false);
        return { status: configured ? "error" : "not_connected", windows: [] };
      }
      const bookings = await this.calcom.listBookings(auth, { status: "upcoming", take: 100 });
      const startMs = start.getTime();
      const endMs = end.getTime();
      return {
        status: "connected",
        windows: bookings
          .flatMap(calComBookingToWindow)
          .filter((window) => overlaps(window, startMs, endMs)),
      };
    } catch {
      return { status: "error", windows: [] };
    }
  }
}

export function canonicalMeetingKey(input: {
  title: string;
  start: string;
  end?: string;
}): string {
  const startMs = Date.parse(input.start);
  const endMs = Date.parse(input.end ?? input.start);
  const startMinute = Number.isNaN(startMs) ? input.start : String(Math.floor(startMs / MIN));
  const duration = Number.isNaN(startMs) || Number.isNaN(endMs)
    ? "unknown"
    : String(Math.max(0, Math.round((endMs - startMs) / MIN)));
  return `${startMinute}:${duration}:${stableHash(normalizeTitle(input.title))}`;
}

export function meetingsLikelySame(
  left: Pick<BusyWindow, "title" | "start" | "end" | "attendees">,
  right: Pick<BusyWindow, "title" | "start" | "end" | "attendees">,
): boolean {
  const sameTime =
    Math.abs(Date.parse(left.start) - Date.parse(right.start)) < MIN &&
    Math.abs(Date.parse(left.end) - Date.parse(right.end)) < MIN;
  if (!sameTime) return false;

  const leftTitle = normalizeTitle(left.title);
  const rightTitle = normalizeTitle(right.title);
  if (leftTitle && leftTitle === rightTitle) return true;

  const leftAttendees = new Set(left.attendees.map(normalizeEmail).filter(Boolean));
  return right.attendees.some((attendee) => leftAttendees.has(normalizeEmail(attendee)));
}

export function dedupeBusyWindows(windows: BusyWindow[]): BusyWindow[] {
  const sorted = [...windows].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const unique: BusyWindow[] = [];

  for (const window of sorted) {
    const existing = unique.find((candidate) => meetingsLikelySame(candidate, window));
    if (!existing) {
      unique.push({
        ...window,
        attendees: [...new Set(window.attendees.map(normalizeEmail).filter(Boolean))],
        sources: [...window.sources],
      });
      continue;
    }

    existing.attendees = [...new Set([...existing.attendees, ...window.attendees].map(normalizeEmail))]
      .filter(Boolean);
    for (const source of window.sources) {
      if (!existing.sources.some((candidate) =>
        candidate.provider === source.provider && candidate.id === source.id)) {
        existing.sources.push(source);
      }
    }
  }

  return unique;
}

function calculateFreeSlots(input: {
  requestedStart: Date;
  durationMs: number;
  timezone: string;
  busy: BusyWindow[];
  count: number;
}): AlternativeSlot[] {
  const requestedMs = input.requestedStart.getTime();
  const localStart = localParts(input.requestedStart, input.timezone);
  const slots: AlternativeSlot[] = [];

  for (let dayOffset = 0; dayOffset <= SEARCH_DAYS && slots.length < input.count; dayOffset += 1) {
    const localDate = new Date(Date.UTC(localStart.year, localStart.month - 1, localStart.day + dayOffset));
    const year = localDate.getUTCFullYear();
    const month = localDate.getUTCMonth() + 1;
    const day = localDate.getUTCDate();

    for (let hour = WORKDAY_START_HOUR; hour < WORKDAY_END_HOUR; hour += 1) {
      for (const minute of [0, SLOT_STEP_MINUTES]) {
        const candidateStart = localDateTimeToUtc(year, month, day, hour, minute, input.timezone);
        const candidateStartMs = candidateStart.getTime();
        if (candidateStartMs <= requestedMs) continue;

        const candidateEnd = new Date(candidateStartMs + input.durationMs);
        const endLocal = localParts(candidateEnd, input.timezone);
        const endsWithinWorkday =
          endLocal.year === year &&
          endLocal.month === month &&
          endLocal.day === day &&
          (endLocal.hour < WORKDAY_END_HOUR ||
            (endLocal.hour === WORKDAY_END_HOUR && endLocal.minute === 0));
        if (!endsWithinWorkday) continue;

        const conflict = input.busy.some((window) =>
          overlaps(window, candidateStartMs, candidateEnd.getTime()),
        );
        if (conflict) continue;

        slots.push({ start: candidateStart.toISOString(), end: candidateEnd.toISOString() });
        if (slots.length >= input.count) break;
      }
      if (slots.length >= input.count) break;
    }
  }

  return slots;
}

function calendarEventToWindow(event: CalendarEvent): BusyWindow[] {
  if (event.allDay || !event.start || !event.end || event.status?.toLowerCase() === "cancelled") {
    return [];
  }
  if (Number.isNaN(Date.parse(event.start)) || Number.isNaN(Date.parse(event.end))) return [];
  return [{
    title: event.title || "Meeting",
    start: event.start,
    end: event.end,
    attendees: event.attendees,
    sources: [{ provider: "google", id: event.id }],
  }];
}

function calComBookingToWindow(booking: CalComBooking): BusyWindow[] {
  if (
    !booking.startTime ||
    !booking.endTime ||
    booking.status?.toLowerCase() === "cancelled" ||
    Number.isNaN(Date.parse(booking.startTime)) ||
    Number.isNaN(Date.parse(booking.endTime))
  ) {
    return [];
  }
  return [{
    title: booking.title || "Meeting",
    start: booking.startTime,
    end: booking.endTime,
    attendees: booking.attendees.map((attendee) => attendee.email),
    sources: [{ provider: "calcom", id: booking.uid || String(booking.id) }],
  }];
}

function invalidWindowReason(startMs: number, endMs: number): string | undefined {
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return "Start and end must be valid ISO date-times.";
  if (endMs <= startMs) return "End time must be after start time.";
  return undefined;
}

function overlaps(window: Pick<BusyWindow, "start" | "end">, startMs: number, endMs: number) {
  return startMs < Date.parse(window.end) && endMs > Date.parse(window.start);
}

function isExcluded(window: BusyWindow, exclude?: CheckAvailabilityInput["exclude"]): boolean {
  if (!exclude) return false;
  return window.sources.some((source) =>
    (source.provider === "google" && source.id === exclude.googleEventId) ||
    (source.provider === "calcom" && source.id === exclude.calComBookingUid),
  );
}

function searchWindowEnd(start: Date, timezone: string): Date {
  const local = localParts(start, timezone);
  const target = new Date(Date.UTC(local.year, local.month - 1, local.day + SEARCH_DAYS + 1));
  return localDateTimeToUtc(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate(),
    0,
    0,
    timezone,
  );
}

function localParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\bcal\.?com\b/g, " ")
    .replace(/\bgoogle meet\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}
