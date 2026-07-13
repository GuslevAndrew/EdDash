import { NextResponse } from "next/server";
import { getImportHistory, getLastSuccessfulImport } from "@/lib/dashboard/queries";
import { probeEdbo } from "@/lib/edbo/client";
import { EDBO_ENDPOINTS } from "@/lib/edbo/constants";

export async function GET() {
  try {
    const [history, lastSuccessful, apiStatus] = await Promise.all([
      getImportHistory(),
      getLastSuccessfulImport(),
      probeEdbo(EDBO_ENDPOINTS.regions, { timeoutMs: 6000, retries: 0 })
    ]);
    return NextResponse.json({
      api: {
        ok: apiStatus.ok,
        status: apiStatus.status,
        kind: apiStatus.kind,
        durationMs: apiStatus.durationMs,
        message: apiStatus.ok ? "API ЄДЕБО доступний." : apiStatus.errorMessage ?? "API ЄДЕБО недоступний."
      },
      lastSuccessful,
      history
    });
  } catch (error) {
    console.error("imports api error", error);
    return NextResponse.json({ message: "Не вдалося отримати історію імпортів." }, { status: 500 });
  }
}
