import { NextResponse } from "next/server";
import { getFilterOptions } from "@/lib/dashboard/queries";

export async function GET() {
  try {
    return NextResponse.json(await getFilterOptions());
  } catch (error) {
    console.error("filters api error", error);
    return NextResponse.json({ message: "Не вдалося отримати фільтри." }, { status: 500 });
  }
}
