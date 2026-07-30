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

export type ImportYearlyOutcomesSource = {
  payload?: unknown;
  parameters?: Record<string, unknown>;
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
    if (existing.sourceHash === row.sourceHash) continue;
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

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function getEndpoint(type: YearlyOutcomeType): string {
  return type === "entrants" ? EDBO_ENDPOINTS.entrants : EDBO_ENDPOINTS.graduates;
}

export async function importYearlyOutcomes(
  options: ImportYearlyOutcomesOptions,
  source?: ImportYearlyOutcomesSource
): Promise<ImportYearlyOutcomesResult> {
  const run = await prisma.importRun.create({
    data: {
      type: options.type,
      status: "running",
      startedAt: new Date(),
      parametersJson: JSON.stringify(source?.parameters ?? options)
    }
  });

  try {
    const payload =
      source?.payload ??
      (await fetchEdboJson(getEndpoint(options.type), {
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
      }));
    const normalizedRows = normalizeYearlyOutcomes(payload, { type: options.type, y: options.year, qf: options.qf, eb: options.eb });
    const rows = aggregateRows(normalizedRows);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    const uniqueRegions = uniqueBy(rows, (row) => row.regionName);
    await prisma.region.createMany({
      data: uniqueRegions.map((row) => ({ externalId: row.regionExternalId, code: row.regionCode, name: row.regionName })),
      skipDuplicates: true
    });
    const regionsByName = new Map(
      (
        await prisma.region.findMany({
          where: { name: { in: uniqueRegions.map((row) => row.regionName) } }
        })
      ).map((region) => [region.name, region])
    );

    const uniqueEducationLevels = uniqueBy(rows, (row) => row.educationLevelCode);
    await prisma.educationLevel.createMany({
      data: uniqueEducationLevels.map((row) => ({ code: row.educationLevelCode, name: row.educationLevelName })),
      skipDuplicates: true
    });
    const educationLevelsByCode = new Map(
      (
        await prisma.educationLevel.findMany({
          where: { code: { in: uniqueEducationLevels.map((row) => row.educationLevelCode) } }
        })
      ).map((educationLevel) => [educationLevel.code, educationLevel])
    );

    const uniqueEntryBases = uniqueBy(rows, (row) => row.entryBaseCode);
    await prisma.entryBase.createMany({
      data: uniqueEntryBases.map((row) => ({ code: row.entryBaseCode, name: row.entryBaseName })),
      skipDuplicates: true
    });
    const entryBasesByCode = new Map(
      (
        await prisma.entryBase.findMany({
          where: { code: { in: uniqueEntryBases.map((row) => row.entryBaseCode) } }
        })
      ).map((entryBase) => [entryBase.code, entryBase])
    );

    const uniqueStudyForms = uniqueBy(
      rows.filter((row) => row.studyFormCode && row.studyFormName),
      (row) => row.studyFormCode ?? ""
    );
    if (uniqueStudyForms.length) {
      await prisma.studyForm.createMany({
        data: uniqueStudyForms.map((row) => ({ code: row.studyFormCode ?? "", name: row.studyFormName ?? "" })),
        skipDuplicates: true
      });
    }
    const studyFormsByCode = new Map(
      uniqueStudyForms.length
        ? (
            await prisma.studyForm.findMany({
              where: { code: { in: uniqueStudyForms.map((row) => row.studyFormCode ?? "") } }
            })
          ).map((studyForm) => [studyForm.code, studyForm])
        : []
    );

    const uniqueSpecialities = uniqueBy(rows, (row) => row.specialityCode ?? `name:${row.specialityName}`);
    await prisma.speciality.createMany({
      data: uniqueSpecialities.map((row) => {
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

        return {
          externalId: row.specialityExternalId,
          code: row.specialityCode ?? `name:${row.specialityName}`,
          name: row.specialityName,
          fieldCode: row.fieldCode,
          fieldName: row.fieldName,
          ...canonicalData
        };
      }),
      skipDuplicates: true
    });
    const specialitiesByKey = new Map(
      (
        await prisma.speciality.findMany({
          where: { code: { in: uniqueSpecialities.map((row) => row.specialityCode ?? `name:${row.specialityName}`) } }
        })
      ).map((speciality) => [speciality.code ?? `id:${speciality.id}`, speciality])
    );

    const uniqueInstitutions = uniqueBy(rows, (row) => row.institutionExternalId ?? `name:${row.institutionName}`);
    await prisma.institution.createMany({
      data: uniqueInstitutions.map((row) => {
        const key = row.institutionExternalId ?? `name:${row.institutionName}`;
        const fallbackInstitutionType =
          row.educationLevelCode === "9" ? INSTITUTION_TYPES.professionalPreHigher : INSTITUTION_TYPES.higher;
        const region = regionsByName.get(row.regionName);
        if (!region) throw new Error(`Не знайдено регіон для ${row.regionName}`);

        return {
          externalId: key,
          name: row.institutionName,
          shortName: row.institutionShortName,
          institutionTypeCode: fallbackInstitutionType.code,
          institutionTypeName: fallbackInstitutionType.name,
          regionId: region.id
        };
      }),
      skipDuplicates: true
    });
    const institutionsByKey = new Map(
      (
        await prisma.institution.findMany({
          where: { externalId: { in: uniqueInstitutions.map((row) => row.institutionExternalId ?? `name:${row.institutionName}`) } }
        })
      ).map((institution) => [institution.externalId ?? `id:${institution.id}`, institution])
    );

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
      await prisma.yearlyOutcome.deleteMany({
        where: {
          type: options.type,
          year: { in: [...new Set(detailedRows.map((row) => row.year))] },
          studyFormId: null
        }
      });
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
      for (const row of batch) {
        await prisma.yearlyOutcome.update({
          where: { id: row.id },
          data: { personsCount: row.personsCount, sourceHash: row.sourceHash, regionId: row.regionId, studyFormId: row.studyFormId }
        });
      }
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
