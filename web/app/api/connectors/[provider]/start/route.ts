import { requireSession } from "@/app/api/onboarding/_lib/require-user";
import { callGateway } from "@/app/api/auth/_lib/gateway";
import { sanitizeReturnPath } from "@/app/api/auth/_lib/auth-store";

type ConnectorStartResult = {
  status: string;
  authUrl?: string;
  message?: string;
};

type CalComStartBody = {
  clientId?: string;
  clientSecret?: string;
};

export async function GET(
  request: Request,
  context: RouteContext<"/api/connectors/[provider]/start">,
) {
  const { provider } = await context.params;
  if (provider !== "gmail" && provider !== "calendar" && provider !== "calcom" && provider !== "notion" && provider !== "github") {
    return Response.json({ message: `Unsupported OAuth provider: ${provider}` }, { status: 400 });
  }

  const session = await requireSession();
  if (!session) {
    return Response.redirect(new URL("/login", request.url));
  }

  const requestUrl = new URL(request.url);
  const returnTo = sanitizeReturnPath(requestUrl.searchParams.get("returnTo"), "/dashboard/connectors");
  const region = requestUrl.searchParams.get("region") === "eu" ? "eu" : undefined;
  const regionQuery = region ? `&region=${region}` : "";
  const result = await callGateway<ConnectorStartResult>(
    `/api/connectors/${provider}/start?userId=${encodeURIComponent(session.userId)}&returnTo=${encodeURIComponent(returnTo)}${regionQuery}`,
  );

  if (!result.authUrl) {
    return Response.json({ message: result.message ?? "Connector OAuth could not start" }, { status: 400 });
  }

  return Response.redirect(result.authUrl);
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/connectors/[provider]/start">,
) {
  const { provider } = await context.params;
  if (provider !== "calcom") {
    return Response.json(
      { message: `Custom OAuth credentials are not supported for ${provider}` },
      { status: 400 },
    );
  }

  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Authentication required" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const returnTo = sanitizeReturnPath(requestUrl.searchParams.get("returnTo"), "/dashboard/connectors");
  const body = (await request.json().catch(() => ({}))) as CalComStartBody;
  const result = await callGateway<ConnectorStartResult>(
    `/api/connectors/${provider}/start?userId=${encodeURIComponent(session.userId)}&returnTo=${encodeURIComponent(returnTo)}`,
    {
      clientId: typeof body.clientId === "string" ? body.clientId.trim() : "",
      clientSecret: typeof body.clientSecret === "string" ? body.clientSecret.trim() : "",
    },
  );

  if (!result.authUrl) {
    return Response.json({ message: result.message ?? "Connector OAuth could not start" }, { status: 400 });
  }

  return Response.json({ authUrl: result.authUrl });
}
