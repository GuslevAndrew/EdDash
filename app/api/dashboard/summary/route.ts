import { NextRequest, NextResponse } from "next/server";
import { parsePartialDashboardSearchParams } from "@/lib/dashboard/params";
import { getDashboardSummary } from "@/lib/dashboard/queries";

export async function GET(request: NextRequest) {
  try {
    const filters = parsePartialDashboardSearchParams(request.nextUrl.searchParams);
    return NextResponse.json(await getDashboardSummary(filters));
  } catch (error) {
    console.error("summary api error", error);
    return NextResponse.json({ message: "Не вдалося отримати основні показники." }, { status: 400 });
  }
}
