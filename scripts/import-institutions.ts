import { prisma } from "@/lib/db";
import { fetchEdboJson } from "@/lib/edbo/client";
import { EDBO_ENDPOINTS, INSTITUTION_TYPES } from "@/lib/edbo/constants";
import { normalizeInstitutions } from "@/lib/edbo/normalize";
import { parseBlockedAtDate } from "@/lib/institutions/blocked";

const institutionTypes = [
  INSTITUTION_TYPES.higher,
  INSTITUTION_TYPES.scientific,
  INSTITUTION_TYPES.professionalPreHigher,
  INSTITUTION_TYPES.postgraduate
];
const batchSize = 100;

type PreparedInstitution = ReturnType<typeof normalizeInstitutions>[number] & {
  externalId: string;
  blockedAtDate: Date | null;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parseTypesArg() {
  const index = process.argv.indexOf("--types");
  const values = index >= 0 ? process.argv[index + 1]?.split(",").map((item) => item.trim()).filter(Boolean) : [];
  if (!values.length) return institutionTypes;
  const selected = institutionTypes.filter((item) => values.includes(item.code));
  return selected.length ? selected : institutionTypes;
}

async function main() {
  const selectedInstitutionTypes = parseTypesArg();
  const run = await prisma.importRun.create({
    data: {
      type: "institutions",
      status: "running",
      startedAt: new Date(),
      parametersJson: JSON.stringify({ institutionTypes: selectedInstitutionTypes })
    }
  });

  try {
    const preparedInstitutions: PreparedInstitution[] = [];

    for (const institutionType of selectedInstitutionTypes) {
      console.log(`Отримую заклади: ${institutionType.name} (${institutionType.code})...`);
      const payload = await fetchEdboJson(EDBO_ENDPOINTS.universities, {
        params: { ut: institutionType.code, exp: "json" },
        retries: 2,
        retryDelayMs: 1200,
        timeoutMs: 15000
      });
      const institutions = normalizeInstitutions(payload, institutionType.code);
      preparedInstitutions.push(
        ...institutions.map((institution) => ({
          ...institution,
          externalId: institution.externalId ?? `name:${institution.name}`,
          blockedAtDate: parseBlockedAtDate(institution.blockedAt)
        }))
      );
      console.log(`  Отримано: ${institutions.length}.`);
    }

    const received = preparedInstitutions.length;
    const uniqueRegions = [
      ...new Map(
        preparedInstitutions.map((institution) => [
          institution.regionName,
          {
            externalId: institution.regionCode,
            code: institution.regionCode,
            name: institution.regionName
          }
        ])
      ).values()
    ];

    await prisma.region.createMany({
      data: uniqueRegions,
      skipDuplicates: true
    });

    for (const regionBatch of chunk(uniqueRegions, batchSize)) {
      await prisma.$transaction(
        regionBatch.map((region) =>
          prisma.region.update({
            where: { name: region.name },
            data: { externalId: region.externalId, code: region.code }
          })
        )
      );
    }

    const regions = await prisma.region.findMany({
      where: { name: { in: uniqueRegions.map((region) => region.name) } },
      select: { id: true, name: true }
    });
    const regionsByName = new Map(regions.map((region) => [region.name, region.id]));
    const externalIds = preparedInstitutions.map((institution) => institution.externalId);
    const existingInstitutions = (
      await Promise.all(
        chunk(externalIds, 500).map((externalIdBatch) =>
          prisma.institution.findMany({
            where: { externalId: { in: externalIdBatch } },
            select: { id: true, externalId: true }
          })
        )
      )
    ).flat();
    const existingByExternalId = new Map(
      existingInstitutions
        .filter((institution) => institution.externalId)
        .map((institution) => [institution.externalId ?? "", institution.id])
    );

    const rows = preparedInstitutions
      .map((institution) => {
        const regionId = regionsByName.get(institution.regionName);
        if (!regionId) return null;
        return {
          externalId: institution.externalId,
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
          blockedAtDate: institution.blockedAtDate,
          regionId
        };
      })
      .filter((institution): institution is NonNullable<typeof institution> => Boolean(institution));
    const rowsToCreate = rows.filter((institution) => !existingByExternalId.has(institution.externalId));
    const rowsToUpdate = rows.filter((institution) => existingByExternalId.has(institution.externalId));
    let created = 0;
    let updated = 0;

    for (const createBatch of chunk(rowsToCreate, batchSize)) {
      const result = await prisma.institution.createMany({
        data: createBatch,
        skipDuplicates: true
      });
      created += result.count;
    }

    for (const updateBatch of chunk(rowsToUpdate, 50)) {
      await prisma.$transaction(
        updateBatch.map((institution) =>
          prisma.institution.update({
            where: { externalId: institution.externalId },
            data: institution
          })
        )
      );
      updated += updateBatch.length;
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
