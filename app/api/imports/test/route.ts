import { NextResponse } from "next/server";
import { probeEdbo } from "@/lib/edbo/client";
import { EDBO_ENDPOINTS } from "@/lib/edbo/constants";

export async function POST() {
  const result = await probeEdbo(EDBO_ENDPOINTS.educators, {
    params: { dt: "01.10.2023", qf: "1", eb: "40", exp: "json" },
    timeoutMs: 10000,
    retries: 1,
    retryDelayMs: 1000
  });
  return NextResponse.json({
    message: result.ok ? "Тестовий запит виконано успішно." : "Тестовий запит не повернув коректний JSON.",
    status: result.status,
    ok: result.ok,
    kind: result.kind,
    durationMs: result.durationMs,
    errorMessage: result.errorMessage
  });
}
