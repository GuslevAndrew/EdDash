import { prisma } from "@/lib/db";
import { fetchEdboJson, fetchEdboSpreadsheetRows } from "@/lib/edbo/client";
import { EDBO_ENDPOINTS } from "@/lib/edbo/constants";
import { normalizeSpecialities } from "@/lib/edbo/normalize";
import { getCanonicalSpeciality } from "@/lib/specialities/canonical";

async function main() {
  const run = await prisma.importRun.create({ data: { type: "specialities", status: "running", startedAt: new Date() } });
  try {
    let payload: unknown;
    try {
      payload = await fetchEdboJson(EDBO_ENDPOINTS.specialities, { params: { exp: "json" }, retries: 1, retryDelayMs: 1200 });
    } catch {
      payload = await fetchEdboSpreadsheetRows(EDBO_ENDPOINTS.specialities);
    }
    const specialities = normalizeSpecialities(payload);
    let created = 0;
    let updated = 0;
    for (const speciality of specialities) {
      const canonical = getCanonicalSpeciality({ code: speciality.code, name: speciality.name });
      const canonicalData = canonical.source === "unmapped"
        ? {
            canonicalCode: null,
            canonicalName: null,
            canonicalFieldCode: null,
            canonicalFieldName: null,
            canonicalSource: canonical.source
          }
        : {
            canonicalCode: canonical.code,
            canonicalName: canonical.name,
            canonicalFieldCode: canonical.fieldCode,
            canonicalFieldName: canonical.fieldName,
            canonicalSource: canonical.source
          };
      const existing = await prisma.speciality.findFirst({ where: { OR: [{ code: speciality.code }, { externalId: speciality.externalId }, { name: speciality.name }] } });
      if (existing) {
        await prisma.speciality.update({ where: { id: existing.id }, data: { ...speciality, ...canonicalData } });
        updated += 1;
      } else {
        await prisma.speciality.create({ data: { ...speciality, ...canonicalData, externalId: speciality.externalId ?? speciality.code } });
        created += 1;
      }
    }
    await prisma.importRun.update({ where: { id: run.id }, data: { status: "success", finishedAt: new Date(), recordsReceived: specialities.length, recordsCreated: created, recordsUpdated: updated } });
    console.log(`Імпорт спеціальностей завершено. Створено: ${created}, оновлено: ${updated}.`);
  } catch (error) {
    await prisma.importRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date(), errorsCount: 1, errorMessage: error instanceof Error ? error.message : "Невідома помилка" } });
    throw error;
  }
}

main().catch((error) => {
  console.error("Не вдалося імпортувати спеціальності:", error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
