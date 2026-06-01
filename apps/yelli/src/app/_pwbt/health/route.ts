import { NextResponse } from "next/server";
import { prisma } from "@yelli/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Uptime probe (LOCKED Operations Step 9: uptime.probes includes /_pwbt/health).
 * No auth — rate-limited at edge (Cloudflare). Runs every 5 min via UptimeRobot,
 * alerts to oncall@powerbyteitsolutions.com + telegram-channel.
 *
 * Returns:
 *   200 { ok: true, db: "ok", valkey: "unchecked", signaling: "unchecked" } on healthy
 *   503 { ok: false, db: "down", reason } on degraded
 */
export async function GET() {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  // TODO Phase 7: Valkey + signaling channel pings.
  const valkey = "unchecked" as const;
  const signaling = "unchecked" as const;

  const status = dbOk ? 200 : 503;
  return NextResponse.json(
    {
      ok: dbOk,
      db: dbOk ? "ok" : "down",
      valkey,
      signaling,
    },
    { status },
  );
}
