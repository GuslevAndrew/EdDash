import { prisma } from "@/lib/db";
import { fetchEdboJson, fetchEdboSpreadsheetRows } from "@/lib/edbo/client";
import { EDBO_ENDPOINTS } from "@/lib/edbo/constants";
import { normalizeRegions } from "@/lib/edbo/normalize";

async function main() {
  const run = await prisma.importRun.create({ data: { type: "regions", status: "running", startedAt: new Date() } });
  try {
    let payload: unknown;
    try {
      payload = await fetchEdboJson(EDBO_ENDPOINTS.regions, { params: { exp: "json" }, retries: 1, retryDelayMs: 1200 });
    } catch {
      payload = await fetchEdboSpreadsheetRows(EDBO_ENDPOINTS.regions);
    }
    const regions = normalizeRegions(payload);
    let created = 0;
    let updated = 0;
    for (const region of regions) {
      const where = region.code ? { code: region.code } : { externalId: region.externalId ?? region.name };
      const existing = await prisma.region.findFirst({ where: { OR: [{ code: region.code }, { externalId: region.externalId }, { name: region.name }] } });
      if (existing) {
        await prisma.region.update({ where: { id: existing.id }, data: region });
        updated += 1;
      } else {
        await prisma.region.create({ data: { ...region, externalId: region.externalId ?? where.externalId } });
        created += 1;
      }
    }
    await prisma.importRun.update({ where: { id: run.id }, data: { status: "success", finishedAt: new Date(), recordsReceived: regions.length, recordsCreated: created, recordsUpdated: updated } });
    console.log(`Імпорт регіонів завершено. Створено: ${created}, оновлено: ${updated}.`);
  } catch (error) {
    await prisma.importRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date(), errorsCount: 1, errorMessage: error instanceof Error ? error.message : "Невідома помилка" } });
    throw error;
  }
}

main().catch((error) => {
  console.error("Не вдалося імпортувати регіони:", error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
