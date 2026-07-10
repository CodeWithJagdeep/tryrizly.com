import { callGateway } from "@/app/api/auth/_lib/gateway";
import { demoMeetings, isDemoUser } from "@/app/api/_lib/demo-dashboard-data";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type CalendarEvent = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  allDay: boolean;
  location?: string;
  hangoutLink?: string;
};

type ToolResult = {
  status: string;
  message: string;
  data?: {
    events?: CalendarEvent[];
    next?: unknown;
  };
};

type CalComBooking = {
  uid?: string;
  title: string;
  startTime: string;
  endTime: string;
  status?: string;
  meetingUrl?: string;
  location?: string;
};

type CalComToolResult = {
  status: string;
  data?: { bookings?: CalComBooking[] };
};

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? "");
  const month = parseInt(searchParams.get("month") ?? ""); // 0-indexed

  let payload: Record<string, unknown>;
  let rangeStart: number;
  let rangeEnd: number;
  if (!isNaN(year) && !isNaN(month)) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);
    rangeStart = startDate.getTime();
    rangeEnd = endDate.getTime();
    payload = { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  } else {
    const now = new Date();
    rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    rangeEnd = rangeStart + 86_400_000 - 1;
    payload = { range: "today" };
  }

  if (isDemoUser(session.userId)) {
    return Response.json({
      connected: true,
      googleConnected: true,
      message: "Demo calendar loaded",
      events: demoMeetings().map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        start: meeting.start,
        end: meeting.end,
        allDay: meeting.allDay,
        location: meeting.location,
        hangoutLink: meeting.meetingUrl,
      })),
    });
  }

  const [google, calcomUpcoming, calcomPast] = await Promise.all([
    callGateway<ToolResult>("/api/tools/execute", {
      userId: session.userId,
      name: "calendar_briefing",
      payload,
    }),
    callGateway<CalComToolResult>("/api/tools/execute", {
      userId: session.userId,
      name: "calcom_briefing",
      payload: { status: "upcoming", take: 50 },
    }).catch(() => null),
    callGateway<CalComToolResult>("/api/tools/execute", {
      userId: session.userId,
      name: "calcom_briefing",
      payload: { status: "past", take: 50 },
    }).catch(() => null),
  ]);

  const googleConnected = google.status !== "needs_connection";
  const events: CalendarEvent[] = googleConnected ? (google.data?.events ?? []) : [];

  const seen = new Set(
    events.map((e) => `${e.start ?? ""}|${e.title.trim().toLowerCase()}`),
  );
  const bookings = [
    ...(calcomUpcoming?.data?.bookings ?? []),
    ...(calcomPast?.data?.bookings ?? []),
  ];
  for (const b of bookings) {
    if (b.status?.toLowerCase() === "cancelled") continue;
    const t = Date.parse(b.startTime);
    if (Number.isNaN(t) || t < rangeStart || t > rangeEnd) continue;
    const key = `${b.startTime}|${b.title.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({
      id: `calcom:${b.uid ?? `${b.startTime}-${b.title}`}`,
      title: b.title,
      start: b.startTime,
      end: b.endTime,
      allDay: false,
      location: b.location,
      hangoutLink: b.meetingUrl,
    });
  }

  const calcomConnected = Boolean(calcomUpcoming?.data || calcomPast?.data);
  if (!googleConnected && !calcomConnected) {
    return Response.json({ connected: false, message: google.message });
  }

  return Response.json({
    connected: true,
    googleConnected,
    message: google.message,
    events,
  });
}
