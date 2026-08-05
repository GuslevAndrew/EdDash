import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

type CacheStatsRow = {
  fresh_count: bigint | number | null;
  stale_count: bigint | number | null;
};

function toNumber(value: bigint | number | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

export async function GET() {
  const started = Date.now();
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    const [latestRun, cacheStats] = await Promise.all([
      prisma.importRun.findFirst({
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          errorsCount: true
        }
      }),
      prisma.$queryRaw<CacheStatsRow[]>`
        SELECT
          COUNT(*) FILTER (WHERE "expiresAt" > NOW()) AS fresh_count,
          COUNT(*) FILTER (WHERE "expiresAt" <= NOW()) AS stale_count
        FROM "DashboardApiCache"
      `.catch(() => null)
    ]);

    const firstCacheStats = cacheStats?.[0] ?? null;

    return NextResponse.json(
      {
        ok: true,
        status: "healthy",
        timestamp,
        responseTimeMs: Date.now() - started,
        checks: {
          database: "ok",
          dashboardApiCache: firstCacheStats
            ? {
                fresh: toNumber(firstCacheStats.fresh_count),
                stale: toNumber(firstCacheStats.stale_count)
              }
            : "not_ready",
          latestImportRun: latestRun
        }
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        timestamp,
        responseTimeMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error)
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
