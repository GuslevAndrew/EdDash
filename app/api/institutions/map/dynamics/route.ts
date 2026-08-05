import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readDashboardApiCache, writeDashboardApiCache } from "@/lib/dashboard/api-cache";
import { SUPPORTED_INSTITUTION_TYPE_CODES } from "@/lib/edbo/constants";
import { getCanonicalEducationLevelName } from "@/lib/education-levels/canonical";
import { addSnapshotActiveInstitutionFilter } from "@/lib/institutions/blocked";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400"
};

const dynamicsQuerySchema = z.object({
  level: z.array(z.enum(SUPPORTED_INSTITUTION_TYPE_CODES)).default([]),
  region: z.array(z.coerce.number().int().positive()).default([]),
  institution: z.array(z.coerce.number().int().positive()).default([]),
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

function parseDynamicsQuery(params: URLSearchParams) {
  return dynamicsQuerySchema.parse({
    level: getArrayParam(params, "level"),
    region: getArrayParam(params, "region"),
    institution: getArrayParam(params, "institution"),
    field: getArrayParam(params, "field"),
    speciality: getArrayParam(params, "speciality"),
    educationLevel: getArrayParam(params, "educationLevel"),
    entryBase: getArrayParam(params, "entryBase"),
    studyForm: getArrayParam(params, "studyForm"),
    showBlocked: params.get("showBlocked") ?? undefined
  });
}

type ParsedDynamicsQuery = ReturnType<typeof parseDynamicsQuery>;

function sortNumbers(values: number[]) {
  return [...values].sort((first, second) => first - second);
}

function sortStrings(values: string[]) {
  return [...values].sort((first, second) => first.localeCompare(second, "uk", { numeric: true }));
}

function getDynamicsCacheKey(parsed: ParsedDynamicsQuery): string {
  return JSON.stringify({
    scope: "institutionsMapDynamics",
    version: 2,
    level: sortStrings(parsed.level),
    region: sortNumbers(parsed.region),
    institution: sortNumbers(parsed.institution),
    field: sortStrings(parsed.field),
    speciality: sortStrings(parsed.speciality),
    educationLevel: sortStrings(parsed.educationLevel),
    entryBase: sortNumbers(parsed.entryBase),
    studyForm: sortNumbers(parsed.studyForm),
    showBlocked: parsed.showBlocked === "1"
  });
}

export async function GET(request: Request) {
  try {
    const parsed = parseDynamicsQuery(new URL(request.url).searchParams);
    const cacheKey = getDynamicsCacheKey(parsed);
    const cached = await readDashboardApiCache(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: cacheHeaders });

    const filteredInstitutionTypeCodes = parsed.level.length ? parsed.level : [...SUPPORTED_INSTITUTION_TYPE_CODES];
    const showBlocked = parsed.showBlocked === "1";
    const educationLevels = parsed.educationLevel.length
      ? await prisma.educationLevel.findMany({ select: { id: true, name: true } })
      : [];
    const selectedEducationLevelIds = educationLevels
      .filter((item) => parsed.educationLevel.includes(getCanonicalEducationLevelName(item.name)))
      .map((item) => item.id);

    const where: Prisma.StudentSnapshotWhereInput = {
      regionId: parsed.region.length ? { in: parsed.region } : undefined,
      institutionId: parsed.institution.length ? { in: parsed.institution } : undefined,
      institution: {
        institutionTypeCode: { in: filteredInstitutionTypeCodes }
      },
      speciality: {
        canonicalFieldCode: parsed.field.length ? { in: parsed.field } : undefined,
        canonicalCode: parsed.speciality.length ? { in: parsed.speciality } : undefined
      },
      educationLevelId: selectedEducationLevelIds.length ? { in: selectedEducationLevelIds } : undefined,
      entryBaseId: parsed.entryBase.length ? { in: parsed.entryBase } : undefined,
      studyFormId: parsed.studyForm.length ? { in: parsed.studyForm } : undefined,
      studyForm: parsed.studyForm.length ? undefined : { code: { not: "total" } }
    };
    const snapshotDateRows = await prisma.studentSnapshot.groupBy({
      by: ["snapshotDate"],
      orderBy: { snapshotDate: "asc" }
    });
    const whereWithActiveInstitutions = addSnapshotActiveInstitutionFilter(
      where,
      showBlocked,
      snapshotDateRows.map((item) => item.snapshotDate)
    );

    const grouped = await prisma.studentSnapshot.groupBy({
      by: ["snapshotDate", "institutionId"],
      where: whereWithActiveInstitutions,
      _sum: { studentsCount: true },
      orderBy: [{ snapshotDate: "asc" }, { institutionId: "asc" }]
    });

    const totalsByDate = new Map<string, { institutionsCount: number; studentsCount: number }>();

    for (const item of grouped) {
      const key = item.snapshotDate.toISOString();
      const current = totalsByDate.get(key) ?? { institutionsCount: 0, studentsCount: 0 };
      current.institutionsCount += 1;
      current.studentsCount += item._sum.studentsCount ?? 0;
      totalsByDate.set(key, current);
    }

    const payload = {
      points: [...totalsByDate.entries()].map(([date, totals]) => ({
        date,
        institutionsCount: totals.institutionsCount,
        studentsCount: totals.studentsCount
      }))
    };

    await writeDashboardApiCache("institutionsMapDynamics", cacheKey, payload);
    return NextResponse.json(payload, { headers: cacheHeaders });
  } catch (error) {
    console.error("institutions map dynamics api error", error);
    return NextResponse.json({ message: "Не вдалося отримати динаміку для EdМапи." }, { status: 400 });
  }
}
