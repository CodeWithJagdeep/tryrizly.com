const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:4000";

export function gatewayHeaders(hasBody: boolean) {
  const headers: Record<string, string> = {};
  if (hasBody) headers["content-type"] = "application/json";
  if (process.env.AUTH_INTERNAL_SECRET) {
    headers["x-heyriz-internal-secret"] = process.env.AUTH_INTERNAL_SECRET;
  }
  return Object.keys(headers).length ? headers : undefined;
}

export async function callGateway<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${gatewayUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: gatewayHeaders(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return (await res.json()) as T;
}

export async function deleteGateway<T>(path: string): Promise<{ ok: boolean; status: number; payload: T }> {
  const res = await fetch(`${gatewayUrl}${path}`, {
    method: "DELETE",
    headers: gatewayHeaders(false),
    cache: "no-store",
  });
  return {
    ok: res.ok,
    status: res.status,
    payload: (await res.json().catch(() => ({}))) as T,
  };
}

export async function patchGateway<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; payload: T }> {
  const res = await fetch(`${gatewayUrl}${path}`, {
    method: "PATCH",
    headers: gatewayHeaders(true),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return {
    ok: res.ok,
    status: res.status,
    payload: (await res.json().catch(() => ({}))) as T,
  };
}
