import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const { avatarUrl } = (await request.json()) as { avatarUrl?: string };
  // Raster types only. `data:image/svg+xml` would pass a naive "data:image/"
  // check yet can carry executable script — a stored-XSS vector if the avatar is
  // ever rendered as anything other than an <img src>.
  if (!avatarUrl || !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(avatarUrl)) {
    return Response.json({ message: "Invalid image" }, { status: 400 });
  }
  if (avatarUrl.length > 300_000) {
    return Response.json({ message: "Image too large (max ~200KB)" }, { status: 400 });
  }

  const result = await callGateway("/api/preferences/avatar", {
    userId: session.userId,
    avatarUrl,
  });
  return Response.json(result);
}
