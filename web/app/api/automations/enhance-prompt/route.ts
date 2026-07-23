import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

// The Riz Agent step's "Enhance with AI" button — rewrites the user's rough
// instruction into a precise prompt, without running it against any data.

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { prompt?: string } | null;
  const prompt = body?.prompt?.trim();
  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const result = await callGateway<{ ok?: boolean; prompt?: string; error?: string }>(
    "/api/automations/enhance-prompt",
    { userId: session.userId, prompt },
  ).catch(() => null);

  if (!result?.ok || typeof result.prompt !== "string") {
    const detail =
      result?.error === "ai_budget_exceeded"
        ? "Your AI budget for this cycle is used up."
        : "Couldn't enhance that prompt — try again.";
    return Response.json({ error: detail }, { status: 502 });
  }
  return Response.json({ prompt: result.prompt });
}
