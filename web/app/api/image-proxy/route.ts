import { requireSession } from "@/app/api/onboarding/_lib/require-user";

// Server-side image proxy for connected-account avatars (Google profile photos).
// Fetching them straight from the browser can fail on referrer/hotlink policy;
// proxying also keeps the third-party host out of the page's network surface.
// Locked to Google's image CDNs so this can't be abused as an open proxy.
const ALLOWED_HOSTS = [/(^|\.)googleusercontent\.com$/, /(^|\.)ggpht\.com$/, /(^|\.)google\.com$/];

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return new Response("Missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.some((re) => re.test(target.hostname))) {
    return new Response("Host not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString());
    if (!upstream.ok) return new Response("Upstream error", { status: 502 });
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return new Response("Not an image", { status: 415 });
    return new Response(upstream.body, {
      headers: {
        "content-type": contentType,
        "cache-control": "private, max-age=86400",
      },
    });
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
}
