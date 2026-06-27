import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type Body = {
  title: string;
  start: string;        // ISO datetime
  end: string;          // ISO datetime
  attendees?: string[];
  description?: string;
  timezone?: string;
};

type ToolResult = {
  status?: string;
  message?: string;
  data?: { event?: { hangoutLink?: string; id?: string } };
  error?: string;
};

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const body = (await request.json()) as Body;
  if (!body.title || !body.start || !body.end) {
    return Response.json({ message: "title, start and end are required" }, { status: 400 });
  }

  // 1. Create the Google Calendar event (approved: true skips the agent approval gate)
  const eventResult = await callGateway<ToolResult>("/api/tools/execute", {
    userId: session.userId,
    name: "create_calendar_event",
    payload: {
      summary: body.title,
      start: body.start,
      end: body.end,
      attendees: body.attendees ?? [],
      description: body.description,
      timeZone: body.timezone ?? "UTC",
      approved: true,
    },
  });

  if (eventResult?.status === "needs_connection") {
    return Response.json({ message: "Google Calendar is not connected", code: "needs_connection" }, { status: 422 });
  }
  if (eventResult?.error) {
    return Response.json({ message: eventResult.error }, { status: 400 });
  }

  // 2. Schedule a Telegram reminder 15 minutes before the meeting
  const meetingStart = new Date(body.start);
  const reminderAt = new Date(meetingStart.getTime() - 15 * 60 * 1000);
  if (reminderAt > new Date()) {
    const attendeeList = body.attendees?.length
      ? ` with ${body.attendees.join(", ")}`
      : "";
    await callGateway("/api/tasks/reminders", {
      userId: session.userId,
      message: `⏰ Your meeting "${body.title}"${attendeeList} starts in 15 minutes.`,
      runAt: reminderAt.toISOString(),
      source: "calendar",
    }).catch(() => null); // non-fatal
  }

  return Response.json({
    ok: true,
    event: eventResult?.data?.event,
    hangoutLink: eventResult?.data?.event?.hangoutLink,
  });
}
