import { NextResponse } from "next/server";
import { FILTER_OPTIONS_CACHE_KEY, readDashboardApiCache, writeDashboardApiCache } from "@/lib/dashboard/api-cache";
import { getFilterOptions } from "@/lib/dashboard/queries";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
};

export async function GET() {
  try {
    const cached = await readDashboardApiCache(FILTER_OPTIONS_CACHE_KEY);
    if (cached) return NextResponse.json(cached, { headers: cacheHeaders });

    const payload = await getFilterOptions();
    await writeDashboardApiCache("filters", FILTER_OPTIONS_CACHE_KEY, payload);
    return NextResponse.json(payload, { headers: cacheHeaders });
  } catch (error) {
    console.error("filters api error", error);
    return NextResponse.json({ message: "Не вдалося отримати фільтри." }, { status: 500 });
  }
}
