import { NextRequest, NextResponse } from "next/server";
import { parsePartialDashboardSearchParams } from "@/lib/dashboard/params";
import { getDashboardDynamicsBreakdowns } from "@/lib/dashboard/queries";

const allowedBreakdowns = ["institutions", "regions", "fields", "specialities", "educationLevels", "studyForms"] as const;
type DynamicsBreakdown = (typeof allowedBreakdowns)[number];
const cacheHeaders = {
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400"
};

function parseBreakdowns(searchParams: URLSearchParams): DynamicsBreakdown[] {
  const allowed = new Set<string>(allowedBreakdowns);
  return searchParams.getAll("breakdown").filter((value): value is DynamicsBreakdown => allowed.has(value));
}

export async function GET(request: NextRequest) {
  try {
    const filters = parsePartialDashboardSearchParams(request.nextUrl.searchParams);
    const breakdowns = parseBreakdowns(request.nextUrl.searchParams);
    return NextResponse.json(await getDashboardDynamicsBreakdowns(filters, breakdowns), { headers: cacheHeaders });
  } catch (error) {
    console.error("dynamics breakdowns api error", error);
    return NextResponse.json({ message: "Не вдалося отримати деталізацію динаміки." }, { status: 400 });
  }
}
