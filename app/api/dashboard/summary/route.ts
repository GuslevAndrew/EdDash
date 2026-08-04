import { NextRequest, NextResponse } from "next/server";
import { parsePartialDashboardSearchParams } from "@/lib/dashboard/params";
import { getDashboardSummary } from "@/lib/dashboard/queries";
import { getStandardDashboardCacheKey, readDashboardApiCache, writeDashboardApiCache } from "@/lib/dashboard/api-cache";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400"
};

export async function GET(request: NextRequest) {
  try {
    const filters = parsePartialDashboardSearchParams(request.nextUrl.searchParams);
    const cacheKey = getStandardDashboardCacheKey("summary", filters);
    const cached = cacheKey ? await readDashboardApiCache(cacheKey) : null;
    if (cached) return NextResponse.json(cached, { headers: cacheHeaders });

    const payload = await getDashboardSummary(filters);
    if (cacheKey) await writeDashboardApiCache("summary", cacheKey, payload);
    return NextResponse.json(payload, { headers: cacheHeaders });
  } catch (error) {
    console.error("summary api error", error);
    return NextResponse.json({ message: "Не вдалося отримати основні показники." }, { status: 400 });
  }
}
