import { NextResponse } from "next/server";
import { getFilterOptions } from "@/lib/dashboard/queries";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400"
};

export async function GET() {
  try {
    return NextResponse.json(await getFilterOptions(), { headers: cacheHeaders });
  } catch (error) {
    console.error("filters api error", error);
    return NextResponse.json({ message: "Не вдалося отримати фільтри." }, { status: 500 });
  }
}
