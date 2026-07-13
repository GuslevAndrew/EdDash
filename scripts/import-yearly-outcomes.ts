import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { fetchEdboJson } from "@/lib/edbo/client";
import { EDBO_ENDPOINTS, INSTITUTION_TYPES } from "@/lib/edbo/constants";
import { normalizeYearlyOutcomes } from "@/lib/edbo/normalize";
import type { NormalizedYearlyOutcomeRow, YearlyOutcomeType } from "@/lib/edbo/types";
import { getCanonicalSpeciality } from "@/lib/specialities/canonical";

export type ImportYearlyOutcomesOptions = {
  type: YearlyOutcomeType;
  year: string;
  qf?: string;
  eb?: string;
  sp?: string;
  rg?: string;
  id?: string;
};

export type ImportYearlyOutcomesResult = {
  recordsReceived: number;
  recordsNormalized: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
};

function parseArgs(): ImportYearlyOutcomesOptions {
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
  const type = parsed.type === "graduates" ? "graduates" : "entrants";
  return {
    type,
    year: parsed.year ?? parsed.y ?? "2025",
    qf: parsed.qf,
    eb: parsed.eb,
    sp: parsed.sp,
    rg: parsed.rg,
    id: parsed.id
  };
}

function aggregateRows(rows: NormalizedYearlyOutcomeRow[]): NormalizedYearlyOutcomeRow[] {
  const grouped = new Map<string, NormalizedYearlyOutcomeRow>();

  for (const row of rows) {
    const key = [
      row.type,
      row.year,
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
    existing.personsCount += row.personsCount;
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

function getEndpoint(type: YearlyOutcomeType): string {
  return type === "entrants" ? EDBO_ENDPOINTS.entrants : EDBO_ENDPOINTS.graduates;
}

export async function importYearlyOutcomes(options: ImportYearlyOutcomesOptions): Promise<ImportYearlyOutcomesResult> {
  const run = await prisma.importRun.create({
    data: {
      type: options.type,
      status: "running",
      startedAt: new Date(),
      parametersJson: JSON.stringify(options)
    }
  });

  try {
    const payload = await fetchEdboJson(getEndpoint(options.type), {
      params: {
        y: options.year,
        qf: options.qf,
        eb: options.eb,
        sp: options.sp,
        rg: options.rg,
        id: options.id,
        exp: "json"
      },
      retries: 2,
      retryDelayMs: 1500,
      timeoutMs: 20000
    });
    const normalizedRows = normalizeYearlyOutcomes(payload, { type: options.type, y: options.year, qf: options.qf, eb: options.eb });
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
        update: {
          name: row.specialityName,
          externalId: row.specialityExternalId,
          fieldCode: row.fieldCode,
          fieldName: row.fieldName,
          ...canonicalData
        },
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
      if (!row.studyFormCode || !row.studyFormName || studyFormsByCode.has(row.studyFormCode)) continue;
      const studyForm = await prisma.studyForm.upsert({
        where: { code: row.studyFormCode },
        update: { name: row.studyFormName },
        create: { code: row.studyFormCode, name: row.studyFormName }
      });
      studyFormsByCode.set(row.studyFormCode, studyForm);
    }

    const preparedRows = rows.map((row) => {
      const institution = institutionsByKey.get(row.institutionExternalId ?? `name:${row.institutionName}`);
      const region = regionsByName.get(row.regionName);
      const speciality = specialitiesByKey.get(row.specialityCode ?? `name:${row.specialityName}`);
      const educationLevel = educationLevelsByCode.get(row.educationLevelCode);
      const entryBase = entryBasesByCode.get(row.entryBaseCode);
      const studyForm = row.studyFormCode ? studyFormsByCode.get(row.studyFormCode) : null;
      if (!institution || !region || !speciality || !educationLevel || !entryBase) {
        throw new Error(`Не вдалося підготувати зв'язки для рядка ${row.institutionName}`);
      }
      if (row.studyFormCode && !studyForm) {
        throw new Error(`Не вдалося підготувати форму навчання ${row.studyFormName}`);
      }
      return {
        type: row.type,
        year: row.year,
        institutionId: institution.id,
        regionId: region.id,
        specialityId: speciality.id,
        educationLevelId: educationLevel.id,
        entryBaseId: entryBase.id,
        studyFormId: studyForm?.id ?? null,
        personsCount: row.personsCount,
        sourceHash: row.sourceHash
      };
    });

    const detailedRows = preparedRows.filter((row) => row.studyFormId !== null);
    if (detailedRows.length) {
      const staleTotalKeys = new Set<string>();
      for (const row of detailedRows) {
        staleTotalKeys.add([row.type, row.year, row.institutionId, row.specialityId, row.educationLevelId, row.entryBaseId].join("|"));
      }
      for (const key of staleTotalKeys) {
        const [type, year, institutionId, specialityId, educationLevelId, entryBaseId] = key.split("|");
        await prisma.yearlyOutcome.deleteMany({
          where: {
            type,
            year: Number(year),
            institutionId: Number(institutionId),
            specialityId: Number(specialityId),
            educationLevelId: Number(educationLevelId),
            entryBaseId: Number(entryBaseId),
            studyFormId: null
          }
        });
      }
    }

    const existingRows = await prisma.yearlyOutcome.findMany({
      where: {
        type: options.type,
        year: { in: [...new Set(preparedRows.map((row) => row.year))] },
        institutionId: { in: [...new Set(preparedRows.map((row) => row.institutionId))] }
      },
      select: {
        id: true,
        type: true,
        year: true,
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
        [row.type, row.year, row.institutionId, row.specialityId, row.educationLevelId, row.entryBaseId, row.studyFormId ?? "total"].join("|"),
        row
      ])
    );

    const toCreate: typeof preparedRows = [];
    const toUpdate: Array<(typeof preparedRows)[number] & { id: number }> = [];
    for (const row of preparedRows) {
      const key = [row.type, row.year, row.institutionId, row.specialityId, row.educationLevelId, row.entryBaseId, row.studyFormId ?? "total"].join("|");
      const existing = existingByKey.get(key);
      if (existing && existing.sourceHash === row.sourceHash) {
        skipped += 1;
        continue;
      }
      if (existing) toUpdate.push({ ...row, id: existing.id });
      else toCreate.push(row);
    }

    for (const batch of chunk(toCreate, 500)) {
      const result = await prisma.yearlyOutcome.createMany({ data: batch });
      created += result.count;
    }

    for (const batch of chunk(toUpdate, 100)) {
      await Promise.all(
        batch.map((row) =>
          prisma.yearlyOutcome.update({
            where: { id: row.id },
            data: { personsCount: row.personsCount, sourceHash: row.sourceHash, regionId: row.regionId, studyFormId: row.studyFormId }
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
  const result = await importYearlyOutcomes(options);
  console.log(
    `Імпорт ${options.type} за ${options.year} завершено. Отримано: ${result.recordsReceived}, створено: ${result.recordsCreated}, оновлено: ${result.recordsUpdated}, пропущено: ${result.recordsSkipped}.`
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Не вдалося імпортувати річний набір:", error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
