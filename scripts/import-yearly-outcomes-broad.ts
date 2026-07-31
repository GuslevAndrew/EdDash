import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { fetchEdboSpreadsheetRows } from "@/lib/edbo/client";
import { EDBO_ENDPOINTS } from "@/lib/edbo/constants";
import type { YearlyOutcomeType } from "@/lib/edbo/types";
import { importYearlyOutcomes, type ImportYearlyOutcomesResult } from "./import-yearly-outcomes";

type RequestResult = {
  type: YearlyOutcomeType;
  year: string;
  qf: string;
  eb: string;
  status: "success" | "empty" | "failed";
  durationMs: number;
  rowsFetched: number;
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

type QueryPair = {
  qf: string;
  eb: string;
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

function parseTypes(): YearlyOutcomeType[] {
  const values = parseListArg("types", ["entrants", "graduates"]);
  return values.filter((value): value is YearlyOutcomeType => value === "entrants" || value === "graduates");
}

function parsePairs(qfs: string[], ebs: string[]): QueryPair[] {
  const pairValues = parseListArg("pairs", []);
  if (pairValues.length) {
    return pairValues
      .map((pair) => {
        const [qf, eb] = pair.split(":").map((item) => item.trim());
        return qf && eb ? { qf, eb } : null;
      })
      .filter((pair): pair is QueryPair => pair !== null);
  }

  return qfs.flatMap((qf) => ebs.map((eb) => ({ qf, eb })));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function endpointFor(type: YearlyOutcomeType): string {
  return type === "entrants" ? EDBO_ENDPOINTS.entrants : EDBO_ENDPOINTS.graduates;
}

async function main() {
  const types = parseTypes();
  const years = parseListArg("years", ["2024", "2025"]);
  const qfs = parseListArg("qf", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  const ebs = parseListArg("eb", ["30", "40", "510", "520", "530", "610", "620", "630", "640", "650"]);
  const pairs = parsePairs(qfs, ebs);
  const delayMs = parseNumberArg("delay", 100);
  const timeoutMs = parseNumberArg("timeout", 60_000);
  const requestResults: RequestResult[] = [];
  const yearResults: YearResult[] = [];

  console.log(
    `Starting broad yearly outcome import: types=${types.join(",")}; years=${years.join(",")}; pairs=${pairs.length}.`
  );

  for (const type of types) {
    const endpoint = endpointFor(type);

    for (const year of years) {
      const yearStarted = Date.now();
      const yearRows: Record<string, unknown>[] = [];
      let successfulRequests = 0;
      let emptyRequests = 0;
      let failedRequests = 0;

      console.log(`Year batch: ${type} ${year}`);

      for (const { qf, eb } of pairs) {
          const started = Date.now();

          try {
            const payload = await fetchEdboSpreadsheetRows(endpoint, {
              params: { y: year, qf, eb, exp: "xlsx" },
              retries: 0,
              timeoutMs
            });

            if (!payload.length) {
              emptyRequests += 1;
              requestResults.push({ type, year, qf, eb, status: "empty", durationMs: Date.now() - started, rowsFetched: 0 });
            } else {
              successfulRequests += 1;
              yearRows.push(...payload.map((row) => ({ ...row, qf, eb })));
              requestResults.push({
                type,
                year,
                qf,
                eb,
                status: "success",
                durationMs: Date.now() - started,
                rowsFetched: payload.length
              });
              console.log(`  OK qf=${qf} eb=${eb}: ${payload.length} rows`);
            }
          } catch (error) {
            failedRequests += 1;
            const errorMessage = error instanceof Error ? error.message : String(error);
            requestResults.push({
              type,
              year,
              qf,
              eb,
              status: "failed",
              durationMs: Date.now() - started,
              rowsFetched: 0,
              errorMessage
            });
          }

          if (delayMs > 0) await delay(delayMs);
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
        console.log(`Year batch empty: ${type} ${year}`);
        continue;
      }

      try {
        console.log(`Writing ${type} ${year}: ${yearRows.length} source rows`);
        const result = await importYearlyOutcomes(
          { type, year },
          {
            payload: yearRows,
            parameters: {
              type,
              year,
              source: "edbo-xlsx-broad-yearly",
              qfs,
              ebs,
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
          `Done ${type} ${year}: received=${result.recordsReceived}; created=${result.recordsCreated}; updated=${result.recordsUpdated}; skipped=${result.recordsSkipped}.`
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
        console.log(`Failed to write ${type} ${year}: ${errorMessage}`);
      }
    }
  }

  const totals = yearResults.reduce(
    (sum, item) => ({
      rowsFetched: sum.rowsFetched + item.rowsFetched,
      successfulRequests: sum.successfulRequests + item.successfulRequests,
      emptyRequests: sum.emptyRequests + item.emptyRequests,
      failedRequests: sum.failedRequests + item.failedRequests,
      created: sum.created + (item.result?.recordsCreated ?? 0),
      updated: sum.updated + (item.result?.recordsUpdated ?? 0),
      skipped: sum.skipped + (item.result?.recordsSkipped ?? 0)
    }),
    { rowsFetched: 0, successfulRequests: 0, emptyRequests: 0, failedRequests: 0, created: 0, updated: 0, skipped: 0 }
  );

  const outputDir = join(process.cwd(), "data", "imports");
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, `yearly-outcomes-broad-${types.join("-")}-${years.join("-")}-${Date.now()}.json`);
  await writeFile(
    outputPath,
    JSON.stringify({ types, years, qfs, ebs, pairs, delayMs, timeoutMs, totals, yearResults, requestResults }, null, 2),
    "utf8"
  );

  console.log("Broad yearly outcome import finished.");
  console.log(JSON.stringify(totals, null, 2));
  console.log(`Summary saved: ${outputPath}`);
}

main()
  .catch((error) => {
    console.error("Broad yearly outcome import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
