import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { fetchEdboSpreadsheetRows } from "@/lib/edbo/client";
import { EDBO_ENDPOINTS } from "@/lib/edbo/constants";
import { importYearlyOutcomes, type ImportYearlyOutcomesResult } from "./import-yearly-outcomes";
import type { YearlyOutcomeType } from "@/lib/edbo/types";

type Combo = {
  qf: string;
  eb: string;
  sp: string;
  specialityCode: string | null;
  specialityName: string;
};

type BatchResult = {
  type: YearlyOutcomeType;
  year: string;
  qf: string;
  eb: string;
  sp: string;
  status: "success" | "empty" | "failed";
  durationMs: number;
  rowsFetched?: number;
  result?: ImportYearlyOutcomesResult;
  errorMessage?: string;
};

type YearResult = {
  type: YearlyOutcomeType;
  year: string;
  status: "success" | "empty" | "failed";
  durationMs: number;
  rowsFetched: number;
  successfulRequests: number;
  emptyRequests: number;
  failedRequests: number;
  result?: ImportYearlyOutcomesResult;
  errorMessage?: string;
};

function parseListArg(name: string, fallback: string[]): string[] {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : fallback;
}

function parseNumberArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function parseTypeArg(): YearlyOutcomeType {
  const index = process.argv.indexOf("--type");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value === "entrants" ? "entrants" : "graduates";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCombos(type: YearlyOutcomeType): Promise<Combo[]> {
  const rows = await prisma.yearlyOutcome.findMany({
    where: { type },
    select: {
      educationLevel: { select: { code: true } },
      entryBase: { select: { code: true } },
      speciality: { select: { externalId: true, code: true, name: true } }
    }
  });

  const combos = new Map<string, Combo>();
  for (const row of rows) {
    const sp = row.speciality.externalId;
    if (!sp || sp.startsWith("demo-")) continue;
    const key = [row.educationLevel.code, row.entryBase.code, sp].join("|");
    combos.set(key, {
      qf: row.educationLevel.code,
      eb: row.entryBase.code,
      sp,
      specialityCode: row.speciality.code,
      specialityName: row.speciality.name
    });
  }

  return [...combos.values()].sort((a, b) => {
    const byQf = a.qf.localeCompare(b.qf, "uk");
    if (byQf) return byQf;
    const byEb = a.eb.localeCompare(b.eb, "uk");
    if (byEb) return byEb;
    return a.sp.localeCompare(b.sp, "uk");
  });
}

async function main() {
  const type = parseTypeArg();
  const years = parseListArg("years", ["2020", "2021", "2022", "2023"]);
  const delayMs = parseNumberArg("delay", 300);
  const timeoutMs = parseNumberArg("timeout", 30000);
  const limit = parseNumberArg("limit", 0);
  const combos = (await getCombos(type)).slice(0, limit > 0 ? limit : undefined);
  const totalRequests = years.length * combos.length;
  const endpoint = type === "entrants" ? EDBO_ENDPOINTS.entrants : EDBO_ENDPOINTS.graduates;
  const requestResults: BatchResult[] = [];
  const yearResults: YearResult[] = [];

  console.log(`Починаю grid-імпорт ${type}: ${years.join(", ")}, комбінацій ${combos.length}, запитів ${totalRequests}.`);

  let current = 0;
  for (const year of years) {
    const yearStarted = Date.now();
    const yearRows: Record<string, unknown>[] = [];
    let successfulRequests = 0;
    let emptyRequests = 0;
    let failedRequests = 0;

    for (const combo of combos) {
      current += 1;
      const started = Date.now();
      process.stdout.write(`[${current}/${totalRequests}] ${type} ${year} qf=${combo.qf} eb=${combo.eb} sp=${combo.sp} ... `);

      try {
        const payload = await fetchEdboSpreadsheetRows(endpoint, {
          params: { y: year, qf: combo.qf, eb: combo.eb, sp: combo.sp, exp: "xlsx" },
          retries: 0,
          timeoutMs
        });

        if (!payload.length) {
          requestResults.push({ type, year, ...combo, status: "empty", durationMs: Date.now() - started, rowsFetched: 0 });
          emptyRequests += 1;
          console.log("порожньо");
        } else {
          yearRows.push(...payload.map((row) => ({ ...row, qf: combo.qf, eb: combo.eb, sp: combo.sp })));
          requestResults.push({ type, year, ...combo, status: "success", durationMs: Date.now() - started, rowsFetched: payload.length });
          successfulRequests += 1;
          console.log(`OK: рядків ${payload.length}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        requestResults.push({ type, year, ...combo, status: "failed", durationMs: Date.now() - started, errorMessage });
        failedRequests += 1;
        console.log(`помилка: ${errorMessage}`);
      }

      if (current < totalRequests && delayMs > 0) await delay(delayMs);
    }

    if (!yearRows.length) {
      yearResults.push({
        type,
        year,
        status: "empty",
        durationMs: Date.now() - yearStarted,
        rowsFetched: 0,
        successfulRequests,
        emptyRequests,
        failedRequests
      });
      console.log(`Рік ${year}: немає рядків для імпорту.`);
      continue;
    }

    try {
      console.log(`Рік ${year}: записую ${yearRows.length} Excel-рядків у базу одним імпортом ...`);
      const result = await importYearlyOutcomes(
        { type, year },
        {
          payload: yearRows,
          parameters: {
            type,
            year,
            source: "edbo-xlsx-grid-yearly",
            rowsFetched: yearRows.length,
            successfulRequests,
            emptyRequests,
            failedRequests
          }
        }
      );
      yearResults.push({
        type,
        year,
        status: "success",
        durationMs: Date.now() - yearStarted,
        rowsFetched: yearRows.length,
        successfulRequests,
        emptyRequests,
        failedRequests,
        result
      });
      console.log(
        `Рік ${year}: OK, агреговано ${result.recordsReceived}, створено ${result.recordsCreated}, оновлено ${result.recordsUpdated}, пропущено ${result.recordsSkipped}.`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yearResults.push({
        type,
        year,
        status: "failed",
        durationMs: Date.now() - yearStarted,
        rowsFetched: yearRows.length,
        successfulRequests,
        emptyRequests,
        failedRequests,
        errorMessage
      });
      console.log(`Рік ${year}: помилка запису в базу: ${errorMessage}`);
    }
  }

  const totals = requestResults.reduce(
    (sum, item) => ({
      success: sum.success + (item.status === "success" ? 1 : 0),
      empty: sum.empty + (item.status === "empty" ? 1 : 0),
      failed: sum.failed + (item.status === "failed" ? 1 : 0),
      fetched: sum.fetched + (item.rowsFetched ?? 0),
      created: sum.created,
      updated: sum.updated,
      skipped: sum.skipped
    }),
    { success: 0, empty: 0, failed: 0, fetched: 0, created: 0, updated: 0, skipped: 0 }
  );
  for (const item of yearResults) {
    totals.created += item.result?.recordsCreated ?? 0;
    totals.updated += item.result?.recordsUpdated ?? 0;
    totals.skipped += item.result?.recordsSkipped ?? 0;
  }

  const outputDir = join(process.cwd(), "data", "imports");
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, `yearly-outcomes-grid-${type}-${years.join("-")}-${Date.now()}.json`);
  await writeFile(
    outputPath,
    JSON.stringify({ type, years, delayMs, timeoutMs, combos: combos.length, totals, yearResults, requestResults }, null, 2),
    "utf8"
  );

  console.log("Grid-імпорт завершено.");
  console.log(JSON.stringify(totals, null, 2));
  console.log(`Підсумок збережено: ${outputPath}`);
}

main()
  .catch((error) => {
    console.error("Grid-імпорт завершився критичною помилкою:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
