import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const repo = new URL(request.url).searchParams.get("repo");
  if (!repo) {
    return Response.json({ connected: false, branches: [] });
  }

  const result = await callGateway(
    `/api/automations/github-branches?userId=${encodeURIComponent(session.userId)}&repo=${encodeURIComponent(repo)}`,
  );
  return Response.json(result);
}
