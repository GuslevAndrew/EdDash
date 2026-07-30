import path from "node:path";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { importYearlyOutcomes, type ImportYearlyOutcomesOptions } from "./import-yearly-outcomes";

type ImportXlsxOptions = ImportYearlyOutcomesOptions & {
  file: string;
  sheet?: string;
};

function parseArgs(): ImportXlsxOptions {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index]?.replace(/^--/, "");
    const value = args[index + 1];
    if (key && value && !value.startsWith("--")) {
      parsed[key] = value;
      index += 1;
    }
  }

  if (!parsed.file) throw new Error("Вкажіть шлях до Excel-файлу через --file");

  return {
    type: parsed.type === "graduates" ? "graduates" : "entrants",
    year: parsed.year ?? parsed.y ?? "2025",
    file: parsed.file,
    sheet: parsed.sheet,
    qf: parsed.qf,
    eb: parsed.eb,
    sp: parsed.sp,
    rg: parsed.rg,
    id: parsed.id
  };
}

function readWorkbookRows(filePath: string, sheetName?: string): Record<string, unknown>[] {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const selectedSheet = sheetName ?? workbook.SheetNames[0];
  const sheet = selectedSheet ? workbook.Sheets[selectedSheet] : null;
  if (!selectedSheet || !sheet) {
    throw new Error(`Не знайдено аркуш "${sheetName ?? ""}" у файлі ${filePath}`);
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true
  });
}

async function main() {
  const options = parseArgs();
  const filePath = path.resolve(options.file);
  const rows = readWorkbookRows(filePath, options.sheet);
  const result = await importYearlyOutcomes(options, {
    payload: rows,
    parameters: {
      ...options,
      source: "xlsx",
      fileName: path.basename(filePath),
      rowsInSheet: rows.length
    }
  });

  console.log(
    `Імпорт ${options.type} з Excel за ${options.year} завершено. Рядків у файлі: ${rows.length}, нормалізовано: ${result.recordsNormalized}, агреговано: ${result.recordsReceived}, створено: ${result.recordsCreated}, оновлено: ${result.recordsUpdated}, пропущено: ${result.recordsSkipped}.`
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Не вдалося імпортувати Excel-файл:", error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
