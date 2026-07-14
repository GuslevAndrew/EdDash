import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const run = await prisma.importRun.create({
    data: {
      type: "scheduled-edbo-refresh",
      status: "success",
      startedAt,
      finishedAt: new Date(),
      parametersJson: JSON.stringify({
        mode: "cron-safety-check",
        note: "Cron endpoint is configured. Heavy EDBO imports must be connected through a controlled background workflow."
      })
    }
  });

  return NextResponse.json({
    ok: true,
    importRunId: run.id,
    message: "Scheduled refresh endpoint is reachable. Heavy imports are not executed in this lightweight cron handler yet."
  });
}
