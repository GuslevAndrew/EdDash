import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { warmDashboardApiCache } from "@/lib/dashboard/cache-warmup";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const run = await prisma.importRun.create({
    data: {
      type: "scheduled-edbo-refresh",
      status: "running",
      startedAt,
      parametersJson: JSON.stringify({
        mode: "dashboard-cache-warmup",
        all
      })
    }
  });

  try {
    const result = await warmDashboardApiCache({ all, scopes: ["summary", "charts"] });
    const failed = result.entries.filter((entry) => entry.status === "failed");

    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: failed.length ? "partial" : "success",
        finishedAt: new Date(),
        recordsReceived: result.entries.length,
        recordsUpdated: result.entries.filter((entry) => entry.status === "cached").length,
        errorsCount: failed.length,
        errorMessage: failed.map((entry) => `${entry.scope} ${entry.label}: ${entry.errorMessage}`).join("\n") || null,
        parametersJson: JSON.stringify({
          mode: "dashboard-cache-warmup",
          scopes: ["summary", "charts"],
          all,
          result
        })
      }
    });

    return NextResponse.json({
      ok: true,
      importRunId: run.id,
      message: "Dashboard standard cache was refreshed.",
      result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorsCount: 1,
        errorMessage
      }
    });

    return NextResponse.json({ ok: false, importRunId: run.id, error: errorMessage }, { status: 500 });
  }
}
