import { NextRequest, NextResponse } from "next/server";
import { parsePartialDashboardSearchParams } from "@/lib/dashboard/params";
import { getDashboardSummary } from "@/lib/dashboard/queries";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400"
};

export async function GET(request: NextRequest) {
  try {
    const filters = parsePartialDashboardSearchParams(request.nextUrl.searchParams);
    return NextResponse.json(await getDashboardSummary(filters), { headers: cacheHeaders });
  } catch (error) {
    console.error("summary api error", error);
    return NextResponse.json({ message: "Не вдалося отримати основні показники." }, { status: 400 });
  }
}
