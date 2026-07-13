import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_EDUCATION_LEVELS,
  DEFAULT_ENTRY_BASES,
  DEFAULT_TEST_DATES,
  EDBO_ENDPOINTS
} from "@/lib/edbo/constants";
import { probeEdbo } from "@/lib/edbo/client";
import { extractRows } from "@/lib/edbo/normalize";

const outputDir = join(process.cwd(), "data", "api-tests");

async function main() {
  await mkdir(outputDir, { recursive: true });
  const probes = [
    { label: "Регіони", path: EDBO_ENDPOINTS.regions, params: { exp: "json" } },
    { label: "Спеціальності", path: EDBO_ENDPOINTS.specialities, params: { exp: "json" } },
    ...DEFAULT_TEST_DATES.flatMap((dt) =>
      DEFAULT_EDUCATION_LEVELS.flatMap((qf) =>
        DEFAULT_ENTRY_BASES.map((eb) => ({
          label: `Здобувачі ${dt}, рівень ${qf}, основа ${eb}`,
          path: EDBO_ENDPOINTS.educators,
          params: { dt, qf, eb, exp: "json" }
        }))
      )
    )
  ];

  const summary = [];
  for (const probe of probes) {
    console.log(`Перевіряю: ${probe.label}`);
    const result = await probeEdbo(probe.path, {
      params: probe.params,
      timeoutMs: 12_000,
      retries: 2,
      retryDelayMs: 1_200,
      saveRawTo: outputDir
    });
    const rows = result.kind === "json" ? extractRows(result.body) : [];
    const preview = rows.slice(0, 3);
    console.log(`  HTTP: ${result.status ?? "немає"}`);
    console.log(`  Тип вмісту: ${result.contentType ?? "невідомо"}`);
    console.log(`  Час відповіді: ${result.durationMs} мс`);
    console.log(`  Визначений тип: ${result.kind}`);
    console.log(`  Рядків у відповіді: ${rows.length}`);
    if (result.errorMessage) console.log(`  Попередження: ${result.errorMessage}`);
    if (preview.length) console.log(`  Перші записи: ${JSON.stringify(preview, null, 2).slice(0, 1200)}`);

    summary.push({
      label: probe.label,
      url: result.url,
      status: result.status,
      ok: result.ok,
      contentType: result.contentType,
      durationMs: result.durationMs,
      kind: result.kind,
      rows: rows.length,
      errorMessage: result.errorMessage,
      preview
    });
  }

  await writeFile(join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`Підсумок збережено у ${join(outputDir, "summary.json")}`);
}

main().catch((error) => {
  console.error("Тест API завершився помилкою, але без аварійного падіння окремих запитів:", error);
  process.exitCode = 1;
});
