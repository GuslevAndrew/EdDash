import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SUPPORTED_INSTITUTION_TYPE_CODES } from "@/lib/edbo/constants";
import { getCanonicalEducationLevelName } from "@/lib/education-levels/canonical";
import { mergeInstitutionWhere } from "@/lib/institutions/blocked";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400"
};

const mapQuerySchema = z.object({
  level: z.array(z.enum(SUPPORTED_INSTITUTION_TYPE_CODES)).default([]),
  region: z.array(z.coerce.number().int().positive()).default([]),
  institution: z.array(z.coerce.number().int().positive()).default([]),
  date: z.string().optional(),
  field: z.array(z.string().min(1)).default([]),
  speciality: z.array(z.string().min(1)).default([]),
  educationLevel: z.array(z.string().min(1)).default([]),
  entryBase: z.array(z.coerce.number().int().positive()).default([]),
  studyForm: z.array(z.coerce.number().int().positive()).default([]),
  showBlocked: z.enum(["0", "1"]).optional()
});

function getArrayParam(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).filter((value) => value.trim());
}

function parseMapQuery(params: URLSearchParams) {
  return mapQuerySchema.parse({
    level: getArrayParam(params, "level"),
    region: getArrayParam(params, "region"),
    institution: getArrayParam(params, "institution"),
    date: params.get("date") ?? undefined,
    field: getArrayParam(params, "field"),
    speciality: getArrayParam(params, "speciality"),
    educationLevel: getArrayParam(params, "educationLevel"),
    entryBase: getArrayParam(params, "entryBase"),
    studyForm: getArrayParam(params, "studyForm"),
    showBlocked: params.get("showBlocked") ?? undefined
  });
}

export async function GET(request: Request) {
  try {
    const parsed = parseMapQuery(new URL(request.url).searchParams);
    const filteredInstitutionTypeCodes = parsed.level.length ? parsed.level : [...SUPPORTED_INSTITUTION_TYPE_CODES];
    const showBlocked = parsed.showBlocked === "1";
    const requestedDate = parsed.date && !Number.isNaN(new Date(parsed.date).getTime()) ? new Date(parsed.date) : null;

    const latestSnapshot = requestedDate
      ? null
      : await prisma.studentSnapshot.findFirst({ orderBy: { snapshotDate: "desc" }, select: { snapshotDate: true } });
    const educationLevels = parsed.educationLevel.length
      ? await prisma.educationLevel.findMany({ select: { id: true, name: true } })
      : [];
    const selectedSnapshotDate = requestedDate ?? latestSnapshot?.snapshotDate ?? null;
    const selectedEducationLevelIds = educationLevels
      .filter((item) => parsed.educationLevel.includes(getCanonicalEducationLevelName(item.name)))
      .map((item) => item.id);
    const hasStudentDetailFilters = Boolean(
      parsed.field.length ||
      parsed.speciality.length ||
      selectedEducationLevelIds.length ||
      parsed.entryBase.length ||
      parsed.studyForm.length
    );

    if (!selectedSnapshotDate) {
      return NextResponse.json({ snapshotDate: null, regions: [] }, { headers: cacheHeaders });
    }

    const institutionWhere = mergeInstitutionWhere(
      {
        institutionTypeCode: { in: filteredInstitutionTypeCodes },
        regionId: parsed.region.length ? { in: parsed.region } : undefined,
        id: parsed.institution.length ? { in: parsed.institution } : undefined
      },
      showBlocked,
      selectedSnapshotDate
    );

    const snapshotWhere = {
      snapshotDate: selectedSnapshotDate,
      regionId: parsed.region.length ? { in: parsed.region } : undefined,
      institutionId: parsed.institution.length ? { in: parsed.institution } : undefined,
      institution: institutionWhere,
      speciality: {
        canonicalFieldCode: parsed.field.length ? { in: parsed.field } : undefined,
        canonicalCode: parsed.speciality.length ? { in: parsed.speciality } : undefined
      },
      educationLevelId: selectedEducationLevelIds.length ? { in: selectedEducationLevelIds } : undefined,
      entryBaseId: parsed.entryBase.length ? { in: parsed.entryBase } : undefined,
      studyFormId: parsed.studyForm.length ? { in: parsed.studyForm } : undefined,
      studyForm: parsed.studyForm.length ? undefined : { code: { not: "total" } }
    };

    const regionRows = hasStudentDetailFilters
      ? []
      : await prisma.studentSnapshot.groupBy({
          by: ["regionId"],
          where: snapshotWhere,
          _sum: { studentsCount: true }
        });
    const institutionRows = hasStudentDetailFilters
      ? await prisma.studentSnapshot.groupBy({
          by: ["regionId", "institutionId"],
          where: snapshotWhere,
          _sum: { studentsCount: true }
        })
      : [];

    const institutionCountRows = hasStudentDetailFilters
      ? []
      : await prisma.institution.groupBy({
          by: ["regionId"],
          where: institutionWhere,
          _count: { id: true }
        });

    const regionIds = [
      ...new Set([
        ...regionRows.map((row) => row.regionId).filter((id): id is number => Boolean(id)),
        ...institutionRows.map((row) => row.regionId).filter((id): id is number => Boolean(id)),
        ...institutionCountRows.map((row) => row.regionId).filter((id): id is number => Boolean(id))
      ])
    ];
    const regions = regionIds.length
      ? await prisma.region.findMany({
          where: { id: { in: regionIds } },
          select: { id: true, name: true }
        })
      : [];
    const regionNames = new Map(regions.map((region) => [region.id, region.name]));
    const totalsByRegion = new Map<number, { institutionIds: Set<number>; institutionsCount: number; students: number }>();

    for (const row of institutionCountRows) {
      const regionId = row.regionId ?? 0;
      const current = totalsByRegion.get(regionId) ?? { institutionIds: new Set<number>(), institutionsCount: 0, students: 0 };
      current.institutionsCount = row._count.id;
      totalsByRegion.set(regionId, current);
    }

    for (const row of regionRows) {
      const regionId = row.regionId ?? 0;
      const current = totalsByRegion.get(regionId) ?? { institutionIds: new Set<number>(), institutionsCount: 0, students: 0 };
      current.students += row._sum.studentsCount ?? 0;
      totalsByRegion.set(regionId, current);
    }

    for (const row of institutionRows) {
      const regionId = row.regionId ?? 0;
      const current = totalsByRegion.get(regionId) ?? { institutionIds: new Set<number>(), institutionsCount: 0, students: 0 };
      current.institutionIds.add(row.institutionId);
      current.students += row._sum.studentsCount ?? 0;
      if (hasStudentDetailFilters) current.institutionsCount = current.institutionIds.size;
      totalsByRegion.set(regionId, current);
    }

    return NextResponse.json({
      snapshotDate: selectedSnapshotDate.toISOString(),
      regions: [...totalsByRegion.entries()].map(([regionId, totals]) => ({
        regionId,
        regionName: regionId === 0 ? "Без регіону" : regionNames.get(regionId) ?? "Без регіону",
        institutionsCount: totals.institutionsCount,
        studentsCount: totals.students
      }))
    }, { headers: cacheHeaders });
  } catch (error) {
    console.error("institutions map api error", error);
    return NextResponse.json({ message: "Не вдалося отримати дані для карти." }, { status: 400 });
  }
}
