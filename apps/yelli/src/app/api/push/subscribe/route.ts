import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@yelli/db";
import { getServerSession } from "@/server/auth/session";

export const runtime = "nodejs";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
  deviceId: z.string().cuid().optional(),
  userAgent: z.string().max(512).optional(),
});

/**
 * Web Push subscription registration (LOCKED Step 8: Web Push tap-to-open).
 * Called by the service worker after the user accepts notification permission.
 * Stored per-endpoint — used by the call.invite flow to fan-out push
 * notifications on incoming calls.
 *
 * Schema fields: endpoint (unique), p256dh, auth, deviceId, userId, tenantId.
 * 410 Gone auto-prune happens in the BullMQ worker, not here.
 */
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) return new NextResponse("Invalid subscription", { status: 400 });

  await prisma.webPushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      deviceId: parsed.data.deviceId ?? session.user.id, // fallback to userId as device key
      userId: session.user.id,
      tenantId: session.user.tenantId,
    },
    update: {
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    },
  });

  return NextResponse.json({ ok: true });
}
