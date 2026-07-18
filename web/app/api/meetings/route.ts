import { callGateway } from "@/app/api/auth/_lib/gateway";
import { demoMeetings, isDemoUser } from "@/app/api/_lib/demo-dashboard-data";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type Body = {
  title: string;
  start: string;        // ISO datetime
  end: string;          // ISO datetime
  attendees?: string[];
  description?: string;
  timezone?: string;
  /** Set true to create even when the slot clashes with an existing event. */
  ignoreConflict?: boolean;
};

type ToolResult = {
  status?: string;
  message?: string;
  data?: { event?: { hangoutLink?: string; id?: string } };
  error?: string;
};

type UnifiedMeeting = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  allDay: boolean;
  location?: string;
  meetingUrl?: string;
  attendees: string[];
  source: "google" | "calcom";
  status?: string;
};

type GoogleEvent = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  hangoutLink?: string;
  attendees?: string[];
  status?: string;
};

type CalComBooking = {
  uid?: string;
  title: string;
  startTime: string;
  endTime: string;
  status?: string;
  attendees?: { name: string; email: string }[];
  meetingUrl?: string;
};

/**
 * Unified meetings feed for the dashboard Meetings page: Google Calendar
 * events (which include invites shared over Gmail) merged with Cal.com
 * bookings for [start, end]. Cal.com bookings usually mirror into Google
 * Calendar too, so near-identical entries (same start, same title) are
 * deduped with the Google copy winning.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  if (isDemoUser(session.userId)) {
    return Response.json({
      connected: true,
      googleConnected: true,
      meetings: demoMeetings(),
    });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
    return Response.json({ message: "start and end (ISO) are required" }, { status: 400 });
  }

  const [google, calcomUpcoming, calcomPast] = await Promise.all([
    callGateway<ToolResult & { data?: { events?: GoogleEvent[] } }>("/api/tools/execute", {
      userId: session.userId,
      name: "calendar_briefing",
      payload: { startDate: start, endDate: end },
    }).catch(() => null),
    callGateway<ToolResult & { data?: { bookings?: CalComBooking[] } }>("/api/tools/execute", {
      userId: session.userId,
      name: "calcom_briefing",
      payload: { status: "upcoming", take: 50 },
    }).catch(() => null),
    callGateway<ToolResult & { data?: { bookings?: CalComBooking[] } }>("/api/tools/execute", {
      userId: session.userId,
      name: "calcom_briefing",
      payload: { status: "past", take: 50 },
    }).catch(() => null),
  ]);

  const googleConnected = google?.status !== "needs_connection" && !google?.error;
  const meetings: UnifiedMeeting[] = [];

  for (const ev of google?.data?.events ?? []) {
    if (ev.status === "cancelled") continue;
    meetings.push({
      id: `g:${ev.id}`,
      title: ev.title,
      start: ev.start,
      end: ev.end,
      allDay: Boolean(ev.allDay),
      location: ev.location,
      meetingUrl: ev.hangoutLink,
      attendees: ev.attendees ?? [],
      source: "google",
      status: ev.status,
    });
  }

  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  const seen = new Set(meetings.map((m) => `${m.start ?? ""}|${m.title.trim().toLowerCase()}`));
  const bookings = [
    ...(calcomUpcoming?.data?.bookings ?? []),
    ...(calcomPast?.data?.bookings ?? []),
  ];
  for (const b of bookings) {
    const t = Date.parse(b.startTime);
    if (Number.isNaN(t) || t < startMs || t > endMs) continue;
    if (b.status?.toLowerCase() === "cancelled") continue;
    const key = `${b.startTime}|${b.title.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    meetings.push({
      id: `c:${b.uid ?? `${b.startTime}-${b.title}`}`,
      title: b.title,
      start: b.startTime,
      end: b.endTime,
      allDay: false,
      meetingUrl: b.meetingUrl,
      attendees: (b.attendees ?? []).map((a) => a.name || a.email).filter(Boolean),
      source: "calcom",
      status: b.status,
    });
  }

  meetings.sort((a, b) => Date.parse(a.start ?? "") - Date.parse(b.start ?? ""));

  return Response.json({
    connected: googleConnected || Boolean(calcomUpcoming?.data || calcomPast?.data),
    googleConnected,
    meetings,
  });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const body = (await request.json()) as Body;
  if (!body.title || !body.start || !body.end) {
    return Response.json({ message: "title, start and end are required" }, { status: 400 });
  }

  // 1. Refuse a clashing slot unless the caller explicitly overrides — the
  //    dialog surfaces the conflicting event and offers "create anyway".
  if (!body.ignoreConflict) {
    type ConflictResult = ToolResult & {
      data?: { conflict?: { title?: string; start?: string; end?: string } | null };
    };
    const check = await callGateway<ConflictResult>("/api/tools/execute", {
      userId: session.userId,
      name: "check_calendar_conflict",
      payload: { start: body.start, end: body.end },
    }).catch(() => null);
    const conflict = check?.status === "conflict" ? check.data?.conflict : null;
    if (conflict) {
      return Response.json(
        {
          message: check?.message ?? `This slot clashes with "${conflict.title ?? "another meeting"}".`,
          code: "conflict",
          conflict,
        },
        { status: 409 },
      );
    }
  }

  // Calendar writes enter the same server-owned approval queue as agent actions.
  const proposal = await callGateway<{ approval: { id: string; preview: string } }>(
    "/api/approvals/propose",
    {
    userId: session.userId,
    tool: "create_calendar_event",
    payload: {
      summary: body.title,
      start: body.start,
      end: body.end,
      attendees: body.attendees ?? [],
      description: body.description,
      timeZone: body.timezone ?? "UTC",
    },
    preview: `Create calendar event "${body.title}" from ${body.start} to ${body.end}`,
  });

  return Response.json({
    ok: true,
    approvalRequired: true,
    approval: proposal.approval,
    message: "Meeting proposal is waiting for approval.",
  }, { status: 202 });
}
