import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { fetchEdboJson } from "@/lib/edbo/client";
import { EDBO_ENDPOINTS, INSTITUTION_TYPES } from "@/lib/edbo/constants";
import { importEducatorsOptionsSchema } from "@/lib/edbo/schemas";
import { normalizeEducators } from "@/lib/edbo/normalize";
import { getCanonicalSpeciality } from "@/lib/specialities/canonical";
import type { NormalizedEducatorRow } from "@/lib/edbo/types";

export type ImportEducatorsOptions = {
  dt: string;
  qf?: string;
  eb?: string;
  sp?: string;
  rg?: string;
  id?: string;
};

export type ImportEducatorsResult = {
  recordsReceived: number;
  recordsNormalized: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
};

function parseArgs() {
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
  return importEducatorsOptionsSchema.parse({
    dt: parsed.dt ?? "01.10.2023",
    qf: parsed.qf,
    eb: parsed.eb,
    sp: parsed.sp,
    rg: parsed.rg,
    id: parsed.id
  });
}

function aggregateRows(rows: NormalizedEducatorRow[]): NormalizedEducatorRow[] {
  const grouped = new Map<string, NormalizedEducatorRow>();

  for (const row of rows) {
    const key = [
      row.snapshotDate.toISOString(),
      row.institutionExternalId ?? row.institutionName,
      row.specialityCode ?? row.specialityName,
      row.educationLevelCode,
      row.entryBaseCode,
      row.studyFormCode ?? "total"
    ].join("|");

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...row });
      continue;
    }

    existing.studentsCount += row.studentsCount;
    existing.sourceHash = createHash("sha256")
      .update([existing.sourceHash, row.sourceHash].sort().join(":"))
      .digest("hex");
  }

  return [...grouped.values()];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function importEducators(options: ImportEducatorsOptions): Promise<ImportEducatorsResult> {
  const parsedOptions = importEducatorsOptionsSchema.parse(options);
  const run = await prisma.importRun.create({
    data: { type: "educators", status: "running", startedAt: new Date(), parametersJson: JSON.stringify(parsedOptions) }
  });

  try {
    const payload = await fetchEdboJson(EDBO_ENDPOINTS.educators, {
      params: { ...parsedOptions, exp: "json" },
      retries: 2,
      retryDelayMs: 1500,
      timeoutMs: 15000
    });
    const normalizedRows = normalizeEducators(payload, parsedOptions);
    const rows = aggregateRows(normalizedRows);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    const regionsByName = new Map<string, Awaited<ReturnType<typeof prisma.region.upsert>>>();
    for (const row of rows) {
      if (regionsByName.has(row.regionName)) continue;
      const region = await prisma.region.upsert({
        where: { name: row.regionName },
        update: { externalId: row.regionExternalId, code: row.regionCode },
        create: { externalId: row.regionExternalId, code: row.regionCode, name: row.regionName }
      });
      regionsByName.set(row.regionName, region);
    }

    const institutionsByKey = new Map<string, Awaited<ReturnType<typeof prisma.institution.upsert>>>();
    for (const row of rows) {
      const key = row.institutionExternalId ?? `name:${row.institutionName}`;
      if (institutionsByKey.has(key)) continue;
      const fallbackInstitutionType =
        row.educationLevelCode === "9" ? INSTITUTION_TYPES.professionalPreHigher : INSTITUTION_TYPES.higher;
      const region = regionsByName.get(row.regionName);
      if (!region) throw new Error(`Не знайдено регіон для ${row.regionName}`);
      const institution = await prisma.institution.upsert({
        where: { externalId: key },
        update: { name: row.institutionName, shortName: row.institutionShortName, regionId: region.id },
        create: {
          externalId: key,
          name: row.institutionName,
          shortName: row.institutionShortName,
          institutionTypeCode: fallbackInstitutionType.code,
          institutionTypeName: fallbackInstitutionType.name,
          regionId: region.id
        }
      });
      institutionsByKey.set(key, institution);
    }

    const specialitiesByKey = new Map<string, Awaited<ReturnType<typeof prisma.speciality.upsert>>>();
    for (const row of rows) {
      const key = row.specialityCode ?? `name:${row.specialityName}`;
      if (specialitiesByKey.has(key)) continue;
      const canonical = getCanonicalSpeciality({ code: row.specialityCode, name: row.specialityName });
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
      const speciality = await prisma.speciality.upsert({
        where: { code: key },
        update: { name: row.specialityName, externalId: row.specialityExternalId, fieldCode: row.fieldCode, fieldName: row.fieldName, ...canonicalData },
        create: {
          externalId: row.specialityExternalId,
          code: key,
          name: row.specialityName,
          fieldCode: row.fieldCode,
          fieldName: row.fieldName,
          ...canonicalData
        }
      });
      specialitiesByKey.set(key, speciality);
    }

    const educationLevelsByCode = new Map<string, Awaited<ReturnType<typeof prisma.educationLevel.upsert>>>();
    for (const row of rows) {
      if (educationLevelsByCode.has(row.educationLevelCode)) continue;
      const educationLevel = await prisma.educationLevel.upsert({
        where: { code: row.educationLevelCode },
        update: { name: row.educationLevelName },
        create: { code: row.educationLevelCode, name: row.educationLevelName }
      });
      educationLevelsByCode.set(row.educationLevelCode, educationLevel);
    }

    const entryBasesByCode = new Map<string, Awaited<ReturnType<typeof prisma.entryBase.upsert>>>();
    for (const row of rows) {
      if (entryBasesByCode.has(row.entryBaseCode)) continue;
      const entryBase = await prisma.entryBase.upsert({
        where: { code: row.entryBaseCode },
        update: { name: row.entryBaseName },
        create: { code: row.entryBaseCode, name: row.entryBaseName }
      });
      entryBasesByCode.set(row.entryBaseCode, entryBase);
    }

    const studyFormsByCode = new Map<string, Awaited<ReturnType<typeof prisma.studyForm.upsert>>>();
    for (const row of rows) {
      const studyFormCode = row.studyFormCode ?? "total";
      if (studyFormsByCode.has(studyFormCode)) continue;
      const studyForm = await prisma.studyForm.upsert({
        where: { code: studyFormCode },
        update: { name: row.studyFormName ?? "Усі форми навчання" },
        create: { code: studyFormCode, name: row.studyFormName ?? "Усі форми навчання" }
      });
      studyFormsByCode.set(studyFormCode, studyForm);
    }

    const preparedSnapshots = rows.map((row) => {
      const institution = institutionsByKey.get(row.institutionExternalId ?? `name:${row.institutionName}`);
      const region = regionsByName.get(row.regionName);
      const speciality = specialitiesByKey.get(row.specialityCode ?? `name:${row.specialityName}`);
      const educationLevel = educationLevelsByCode.get(row.educationLevelCode);
      const entryBase = entryBasesByCode.get(row.entryBaseCode);
      const studyForm = studyFormsByCode.get(row.studyFormCode ?? "total");
      if (!institution || !region || !speciality || !educationLevel || !entryBase || !studyForm) {
        throw new Error(`Не вдалося підготувати зв'язки для рядка ${row.institutionName}`);
      }
      return {
        snapshotDate: row.snapshotDate,
        institutionId: institution.id,
        regionId: region.id,
        specialityId: speciality.id,
        educationLevelId: educationLevel.id,
        entryBaseId: entryBase.id,
        studyFormId: studyForm.id,
        studentsCount: row.studentsCount,
        sourceHash: row.sourceHash
      };
    });

    await prisma.studentSnapshot.deleteMany({
      where: {
        snapshotDate: { in: [...new Set(preparedSnapshots.map((row) => row.snapshotDate.getTime()))].map((time) => new Date(time)) },
        institutionId: { in: [...new Set(preparedSnapshots.map((row) => row.institutionId))] },
        studyFormId: null
      }
    });

    const existingRows = await prisma.studentSnapshot.findMany({
      where: {
        snapshotDate: { in: [...new Set(preparedSnapshots.map((row) => row.snapshotDate.getTime()))].map((time) => new Date(time)) },
        institutionId: { in: [...new Set(preparedSnapshots.map((row) => row.institutionId))] }
      },
      select: {
        id: true,
        snapshotDate: true,
        institutionId: true,
        specialityId: true,
        educationLevelId: true,
        entryBaseId: true,
        studyFormId: true,
        sourceHash: true
      }
    });
    const existingByKey = new Map(
      existingRows.map((row) => [
        [row.snapshotDate.toISOString(), row.institutionId, row.specialityId, row.educationLevelId, row.entryBaseId, row.studyFormId ?? "total"].join("|"),
        row
      ])
    );

    const toCreate: typeof preparedSnapshots = [];
    const toUpdate: Array<(typeof preparedSnapshots)[number] & { id: number }> = [];

    for (const row of preparedSnapshots) {
      const key = [row.snapshotDate.toISOString(), row.institutionId, row.specialityId, row.educationLevelId, row.entryBaseId, row.studyFormId ?? "total"].join("|");
      const existing = existingByKey.get(key);

      if (existing && existing.sourceHash === row.sourceHash) {
        skipped += 1;
        continue;
      }
      if (existing) {
        toUpdate.push({ ...row, id: existing.id });
      } else {
        toCreate.push(row);
      }
    }

    for (const batch of chunk(toCreate, 500)) {
      const result = await prisma.studentSnapshot.createMany({ data: batch });
      created += result.count;
    }

    for (const batch of chunk(toUpdate, 100)) {
      await Promise.all(
        batch.map((row) =>
          prisma.studentSnapshot.update({
            where: { id: row.id },
            data: { studentsCount: row.studentsCount, sourceHash: row.sourceHash, regionId: row.regionId, studyFormId: row.studyFormId }
          })
        )
      );
      updated += batch.length;
    }

    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        recordsReceived: normalizedRows.length,
        recordsCreated: created,
        recordsUpdated: updated,
        recordsSkipped: skipped
      }
    });

    return {
      recordsReceived: rows.length,
      recordsNormalized: normalizedRows.length,
      recordsCreated: created,
      recordsUpdated: updated,
      recordsSkipped: skipped
    };
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

async function main() {
  const options = parseArgs();
  const result = await importEducators(options);
  console.log(
    `Імпорт здобувачів завершено. Отримано: ${result.recordsReceived}, створено: ${result.recordsCreated}, оновлено: ${result.recordsUpdated}, пропущено: ${result.recordsSkipped}.`
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Не вдалося імпортувати здобувачів:", error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
