import { requireSession } from "@/app/api/onboarding/_lib/require-user";
import { callGateway } from "@/app/api/auth/_lib/gateway";
import { sanitizeReturnPath } from "@/app/api/auth/_lib/auth-store";

type GoogleStartResult = {
  status: string;
  authUrl?: string;
  message?: string;
};

export async function GET(
  request: Request,
  context: RouteContext<"/api/connectors/[provider]/start">,
) {
  const { provider } = await context.params;
  if (provider !== "gmail" && provider !== "calendar") {
    return Response.json({ message: `Unsupported OAuth provider: ${provider}` }, { status: 400 });
  }

  const session = await requireSession();
  if (!session) {
    return Response.redirect(new URL("/login", request.url));
  }

  const requestUrl = new URL(request.url);
  const returnTo = sanitizeReturnPath(requestUrl.searchParams.get("returnTo"), "/dashboard/connectors");
  const result = await callGateway<GoogleStartResult>(
    `/api/connectors/${provider}/start?userId=${encodeURIComponent(session.userId)}&returnTo=${encodeURIComponent(returnTo)}`,
  );

  if (!result.authUrl) {
    return Response.json({ message: result.message ?? "Google OAuth could not start" }, { status: 400 });
  }

  return Response.redirect(result.authUrl);
}
