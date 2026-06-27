import { callGateway } from "@/app/api/auth/_lib/gateway";

export async function GET() {
  const result = await callGateway("/api/billing/plans");
  return Response.json(result);
}
