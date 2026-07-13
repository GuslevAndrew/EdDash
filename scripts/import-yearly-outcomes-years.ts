import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { importYearlyOutcomes, type ImportYearlyOutcomesResult } from "./import-yearly-outcomes";
import type { YearlyOutcomeType } from "@/lib/edbo/types";

const DEFAULT_TYPES: YearlyOutcomeType[] = ["entrants", "graduates"];
const DEFAULT_YEARS = ["2024", "2025"];
const DEFAULT_QFS = ["1", "2"];
const DEFAULT_EBS = ["40", "620"];
const DEFAULT_SPECIALITY_IDS = ["1970", "1876", "2068"];
const DEFAULT_DELAY_MS = 1200;

type BatchResult = {
  type: YearlyOutcomeType;
  year: string;
  qf: string;
  eb: string;
  sp: string;
  status: "success" | "failed";
  durationMs: number;
  result?: ImportYearlyOutcomesResult;
  errorMessage?: string;
};

function parseListArg(name: string, fallback: string[]): string[] {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : fallback;
}

function parseTypesArg(): YearlyOutcomeType[] {
  return parseListArg("types", DEFAULT_TYPES).filter((item): item is YearlyOutcomeType => item === "entrants" || item === "graduates");
}

function parseNumberArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const types = parseTypesArg();
  const years = parseListArg("years", DEFAULT_YEARS);
  const qfs = parseListArg("qf", DEFAULT_QFS);
  const ebs = parseListArg("eb", DEFAULT_EBS);
  const specialities = parseListArg("sp", DEFAULT_SPECIALITY_IDS);
  const delayMs = parseNumberArg("delay", DEFAULT_DELAY_MS);
  const totalRequests = types.length * years.length * qfs.length * ebs.length * specialities.length;
  const results: BatchResult[] = [];

  console.log(`Починаю batch-імпорт entrants/graduates: ${totalRequests} запитів, пауза ${delayMs} мс.`);

  let current = 0;
  for (const type of types) {
    for (const year of years) {
      for (const qf of qfs) {
        for (const eb of ebs) {
          for (const sp of specialities) {
            current += 1;
            const started = Date.now();
            process.stdout.write(`[${current}/${totalRequests}] ${type}, ${year}, qf=${qf}, eb=${eb}, sp=${sp} ... `);
            try {
              const result = await importYearlyOutcomes({ type, year, qf, eb, sp });
              results.push({ type, year, qf, eb, sp, status: "success", durationMs: Date.now() - started, result });
              console.log(
                `OK: отримано ${result.recordsReceived}, створено ${result.recordsCreated}, оновлено ${result.recordsUpdated}, пропущено ${result.recordsSkipped}`
              );
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Невідома помилка";
              results.push({ type, year, qf, eb, sp, status: "failed", durationMs: Date.now() - started, errorMessage });
              console.log(`помилка: ${errorMessage}`);
            }
            if (current < totalRequests && delayMs > 0) await delay(delayMs);
          }
        }
      }
    }
  }

  const successful = results.filter((item) => item.status === "success");
  const failed = results.filter((item) => item.status === "failed");
  const totals = successful.reduce(
    (sum, item) => ({
      received: sum.received + (item.result?.recordsReceived ?? 0),
      created: sum.created + (item.result?.recordsCreated ?? 0),
      updated: sum.updated + (item.result?.recordsUpdated ?? 0),
      skipped: sum.skipped + (item.result?.recordsSkipped ?? 0)
    }),
    { received: 0, created: 0, updated: 0, skipped: 0 }
  );

  const outputDir = join(process.cwd(), "data", "imports");
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, `yearly-outcomes-${years.join("-")}-${Date.now()}.json`);
  await writeFile(outputPath, JSON.stringify({ types, years, qfs, ebs, specialities, delayMs, totals, results }, null, 2), "utf8");

  console.log("Batch-імпорт entrants/graduates завершено.");
  console.log(`Успішних запитів: ${successful.length}. Невдалих запитів: ${failed.length}.`);
  console.log(`Отримано записів: ${totals.received}. Створено: ${totals.created}. Оновлено: ${totals.updated}. Пропущено: ${totals.skipped}.`);
  console.log(`Підсумок збережено: ${outputPath}`);
}

main()
  .catch((error) => {
    console.error("Batch-імпорт entrants/graduates завершився критичною помилкою:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
