import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type ToolResult = {
  status: string;
  message: string;
  data?: {
    events?: unknown[];
    next?: unknown;
  };
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
  if (!isNaN(year) && !isNaN(month)) {
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    payload = { startDate, endDate };
  } else {
    payload = { range: "today" };
  }

  const result = await callGateway<ToolResult>("/api/tools/execute", {
    userId: session.userId,
    name: "calendar_briefing",
    payload,
  });

  if (result.status === "needs_connection") {
    return Response.json({ connected: false, message: result.message });
  }

  return Response.json({
    connected: true,
    message: result.message,
    events: result.data?.events ?? [],
  });
}
