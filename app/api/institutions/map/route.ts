import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCanonicalEducationLevelName } from "@/lib/education-levels/canonical";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400"
};

const mapQuerySchema = z.object({
  level: z.array(z.enum(["1", "9"])).default([]),
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
    const filteredInstitutionTypeCodes = parsed.level.length ? parsed.level : ["1", "9"];
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

    const rows = await prisma.studentSnapshot.groupBy({
      by: ["regionId", "institutionId"],
      where: {
        snapshotDate: selectedSnapshotDate,
        regionId: parsed.region.length ? { in: parsed.region } : undefined,
        institutionId: parsed.institution.length ? { in: parsed.institution } : undefined,
        institution: {
          institutionTypeCode: { in: filteredInstitutionTypeCodes },
          blockedAt: showBlocked ? undefined : null
        },
        speciality: {
          canonicalFieldCode: parsed.field.length ? { in: parsed.field } : undefined,
          canonicalCode: parsed.speciality.length ? { in: parsed.speciality } : undefined
        },
        educationLevelId: selectedEducationLevelIds.length ? { in: selectedEducationLevelIds } : undefined,
        entryBaseId: parsed.entryBase.length ? { in: parsed.entryBase } : undefined,
        studyFormId: parsed.studyForm.length ? { in: parsed.studyForm } : undefined,
        studyForm: parsed.studyForm.length ? undefined : { code: "total" }
      },
      _sum: { studentsCount: true }
    });

    const institutionCountRows = hasStudentDetailFilters
      ? []
      : await prisma.institution.groupBy({
          by: ["regionId"],
          where: {
            institutionTypeCode: { in: filteredInstitutionTypeCodes },
            regionId: parsed.region.length ? { in: parsed.region } : undefined,
            id: parsed.institution.length ? { in: parsed.institution } : undefined,
            blockedAt: showBlocked ? undefined : null
          },
          _count: { id: true }
        });

    const regionIds = [
      ...new Set([
        ...rows.map((row) => row.regionId).filter((id): id is number => Boolean(id)),
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

    for (const row of rows) {
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
