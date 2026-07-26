import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { importEducators, type ImportEducatorsResult } from "./import-educators";

const EDUCATION_LEVELS = ["1", "2", "3", "4", "6", "9", "7", "10"];
const ENTRY_BASES = ["25", "30", "40", "510", "530", "520", "610", "620", "630", "640", "650"];
const DEFAULT_VALID_PAIRS = [
  ["1", "40"],
  ["1", "530"],
  ["1", "520"],
  ["1", "610"],
  ["1", "620"],
  ["2", "40"],
  ["2", "530"],
  ["2", "520"],
  ["2", "610"],
  ["2", "620"],
  ["2", "630"],
  ["2", "640"],
  ["3", "40"],
  ["3", "520"],
  ["3", "620"],
  ["3", "630"],
  ["4", "30"],
  ["4", "40"],
  ["4", "510"],
  ["4", "520"],
  ["6", "40"],
  ["6", "530"],
  ["6", "520"],
  ["6", "610"],
  ["9", "30"],
  ["9", "40"],
  ["9", "510"],
  ["9", "530"],
  ["9", "520"],
  ["9", "610"],
  ["9", "620"],
  ["9", "640"],
  ["7", "640"],
  ["7", "650"],
  ["10", "640"]
] as const;
const QUARTER_DAYS = ["01.01", "01.04", "01.07", "01.10"];
const DEFAULT_YEARS = ["2024", "2025"];
const DEFAULT_DELAY_MS = 1200;

type BatchResult = {
  dt: string;
  qf: string;
  eb: string;
  status: "success" | "failed";
  durationMs: number;
  result?: ImportEducatorsResult;
  errorMessage?: string;
};

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const years = parseListArg("years", DEFAULT_YEARS);
  const qfs = parseListArg("qf", EDUCATION_LEVELS);
  const ebs = parseListArg("eb", ENTRY_BASES);
  const useKnownValidPairs = hasFlag("known-valid-pairs");
  const explicitDates = parseListArg("dates", []);
  const delayMs = parseNumberArg("delay", DEFAULT_DELAY_MS);
  const dates = explicitDates.length ? explicitDates : years.flatMap((year) => QUARTER_DAYS.map((day) => `${day}.${year}`));
  const pairs = useKnownValidPairs
    ? DEFAULT_VALID_PAIRS.map(([qf, eb]) => ({ qf, eb })).filter((pair) => qfs.includes(pair.qf) && ebs.includes(pair.eb))
    : qfs.flatMap((qf) => ebs.map((eb) => ({ qf, eb })));
  const totalRequests = dates.length * pairs.length;
  const results: BatchResult[] = [];

  console.log(`Починаю batch-імпорт здобувачів: ${dates.length} дат, ${pairs.length} пар освітній ступінь / основа вступу.`);
  console.log(`Усього запитів: ${totalRequests}. Пауза між запитами: ${delayMs} мс.`);

  let current = 0;
  for (const dt of dates) {
    for (const { qf, eb } of pairs) {
        current += 1;
        const started = Date.now();
        process.stdout.write(`[${current}/${totalRequests}] ${dt}, qf=${qf}, eb=${eb} ... `);

        try {
          const result = await importEducators({ dt, qf, eb });
          results.push({ dt, qf, eb, status: "success", durationMs: Date.now() - started, result });
          console.log(
            `OK: отримано ${result.recordsReceived}, створено ${result.recordsCreated}, оновлено ${result.recordsUpdated}, пропущено ${result.recordsSkipped}`
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Невідома помилка";
          results.push({ dt, qf, eb, status: "failed", durationMs: Date.now() - started, errorMessage });
          console.log(`помилка: ${errorMessage}`);
        }

        if (current < totalRequests && delayMs > 0) {
          await delay(delayMs);
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
  const outputPath = join(outputDir, `educators-${years.join("-")}-${Date.now()}.json`);
  await writeFile(outputPath, JSON.stringify({ years, qfs, ebs, pairs, delayMs, totals, results }, null, 2), "utf8");

  console.log("Batch-імпорт завершено.");
  console.log(`Успішних запитів: ${successful.length}. Невдалих запитів: ${failed.length}.`);
  console.log(`Отримано записів: ${totals.received}. Створено: ${totals.created}. Оновлено: ${totals.updated}. Пропущено: ${totals.skipped}.`);
  console.log(`Підсумок збережено: ${outputPath}`);
}

main()
  .catch((error) => {
    console.error("Batch-імпорт завершився критичною помилкою:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
