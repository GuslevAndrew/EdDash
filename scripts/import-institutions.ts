import { prisma } from "@/lib/db";
import { fetchEdboJson } from "@/lib/edbo/client";
import { EDBO_ENDPOINTS, INSTITUTION_TYPES } from "@/lib/edbo/constants";
import { normalizeInstitutions } from "@/lib/edbo/normalize";

const institutionTypes = [INSTITUTION_TYPES.higher, INSTITUTION_TYPES.professionalPreHigher];

async function main() {
  const run = await prisma.importRun.create({
    data: {
      type: "institutions",
      status: "running",
      startedAt: new Date(),
      parametersJson: JSON.stringify({ institutionTypes })
    }
  });

  try {
    let received = 0;
    let created = 0;
    let updated = 0;

    for (const institutionType of institutionTypes) {
      const payload = await fetchEdboJson(EDBO_ENDPOINTS.universities, {
        params: { ut: institutionType.code, exp: "json" },
        retries: 2,
        retryDelayMs: 1200,
        timeoutMs: 15000
      });
      const institutions = normalizeInstitutions(payload, institutionType.code);
      received += institutions.length;

      for (const institution of institutions) {
        const region = await prisma.region.upsert({
          where: { name: institution.regionName },
          update: { code: institution.regionCode },
          create: {
            externalId: institution.regionCode,
            code: institution.regionCode,
            name: institution.regionName
          }
        });

        const externalId = institution.externalId ?? `name:${institution.name}`;
        const existing = await prisma.institution.findUnique({ where: { externalId } });
        if (existing) {
          await prisma.institution.update({
            where: { id: existing.id },
            data: {
              name: institution.name,
              parentExternalId: institution.parentExternalId,
              shortName: institution.shortName,
              institutionTypeCode: institution.institutionTypeCode,
              institutionTypeName: institution.institutionTypeName,
              foundationYear: institution.foundationYear,
              ownership: institution.ownership,
              settlement: institution.settlement,
              address: institution.address,
              phone: institution.phone,
              email: institution.email,
              website: institution.website,
              blockedAt: institution.blockedAt,
              regionId: region.id
            }
          });
          updated += 1;
        } else {
          await prisma.institution.create({
            data: {
              externalId,
              parentExternalId: institution.parentExternalId,
              name: institution.name,
              shortName: institution.shortName,
              institutionTypeCode: institution.institutionTypeCode,
              institutionTypeName: institution.institutionTypeName,
              foundationYear: institution.foundationYear,
              ownership: institution.ownership,
              settlement: institution.settlement,
              address: institution.address,
              phone: institution.phone,
              email: institution.email,
              website: institution.website,
              blockedAt: institution.blockedAt,
              regionId: region.id
            }
          });
          created += 1;
        }
      }
    }

    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        recordsReceived: received,
        recordsCreated: created,
        recordsUpdated: updated
      }
    });

    console.log(`Імпорт закладів завершено. Отримано: ${received}, створено: ${created}, оновлено: ${updated}.`);
  } catch (error) {
    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorsCount: 1,
        errorMessage: error instanceof Error ? error.message : "Невідома помилка"
      }
    });
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("Не вдалося імпортувати заклади:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
