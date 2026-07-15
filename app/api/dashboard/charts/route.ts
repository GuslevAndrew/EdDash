import { NextRequest, NextResponse } from "next/server";
import { parsePartialDashboardSearchParams } from "@/lib/dashboard/params";
import { getDashboardCharts } from "@/lib/dashboard/queries";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400"
};

export async function GET(request: NextRequest) {
  try {
    const filters = parsePartialDashboardSearchParams(request.nextUrl.searchParams);
    return NextResponse.json(await getDashboardCharts(filters), { headers: cacheHeaders });
  } catch (error) {
    console.error("charts api error", error);
    return NextResponse.json({ message: "Не вдалося отримати дані графіків." }, { status: 400 });
  }
}
