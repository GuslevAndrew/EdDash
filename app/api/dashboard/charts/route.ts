import { NextRequest, NextResponse } from "next/server";
import { parsePartialDashboardSearchParams } from "@/lib/dashboard/params";
import { getDashboardCharts } from "@/lib/dashboard/queries";
import { getStandardDashboardCacheKey, readDashboardApiCache, writeDashboardApiCache } from "@/lib/dashboard/api-cache";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400"
};

export async function GET(request: NextRequest) {
  try {
    const filters = parsePartialDashboardSearchParams(request.nextUrl.searchParams);
    const cacheKey = getStandardDashboardCacheKey("charts", filters);
    const cached = cacheKey ? await readDashboardApiCache(cacheKey) : null;
    if (cached) return NextResponse.json(cached, { headers: cacheHeaders });

    const payload = await getDashboardCharts(filters);
    if (cacheKey) await writeDashboardApiCache("charts", cacheKey, payload);
    return NextResponse.json(payload, { headers: cacheHeaders });
  } catch (error) {
    console.error("charts api error", error);
    return NextResponse.json({ message: "Не вдалося отримати дані графіків." }, { status: 400 });
  }
}
