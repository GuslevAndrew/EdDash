import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/demo/seed";

export async function POST() {
  try {
    const result = await seedDemoData();
    return NextResponse.json({ message: "Демонстраційні дані завантажено.", ...result });
  } catch (error) {
    console.error("demo import api error", error);
    return NextResponse.json({ message: "Не вдалося завантажити демонстраційні дані." }, { status: 500 });
  }
}
