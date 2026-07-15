import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCanonicalEducationLevelName } from "@/lib/education-levels/canonical";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400"
};

function getNumberParams(searchParams: URLSearchParams, key: string): number[] {
  return searchParams
    .getAll(key)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selectedInstitutionIds = getNumberParams(searchParams, "institution");
  const showBlocked = searchParams.get("showBlocked") === "1";

  const statsWhere: Prisma.InstitutionWhereInput = {
    institutionTypeCode: { in: ["1", "9"] },
    blockedAt: showBlocked ? undefined : null
  };

  const [
    regions,
    selectedInstitutions,
    totalByLevel,
    totalRegions,
    latestSnapshot,
    snapshotDateRows,
    specialities,
    educationLevels,
    entryBases,
    studyForms
  ] = await prisma.$transaction([
    prisma.region.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.institution.findMany({
      where: { id: { in: selectedInstitutionIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.institution.groupBy({
      by: ["institutionTypeCode", "institutionTypeName"],
      where: statsWhere,
      _count: { id: true },
      orderBy: { institutionTypeCode: "asc" }
    }),
    prisma.region.count({ where: { institutions: { some: statsWhere } } }),
    prisma.studentSnapshot.findFirst({
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true }
    }),
    prisma.studentSnapshot.groupBy({
      by: ["snapshotDate"],
      _count: { _all: true },
      orderBy: { snapshotDate: "desc" }
    }),
    prisma.speciality.findMany({
      where: { canonicalCode: { not: null }, canonicalName: { not: null }, canonicalFieldCode: { not: null } },
      distinct: ["canonicalCode"],
      select: { canonicalCode: true, canonicalName: true, canonicalFieldCode: true },
      orderBy: [{ canonicalFieldCode: "asc" }, { canonicalCode: "asc" }]
    }),
    prisma.educationLevel.findMany({
      orderBy: { name: "asc" },
      select: { name: true }
    }),
    prisma.entryBase.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.studyForm.findMany({
      where: { code: { not: "total" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);

  const educationLevelOptions = [
    ...new Map(
      educationLevels.map((item) => {
        const name = getCanonicalEducationLevelName(item.name);
        return [name, { value: name, label: name }];
      })
    ).values()
  ].sort((first, second) => first.label.localeCompare(second.label, "uk"));

  return NextResponse.json({
    regions,
    selectedInstitutions,
    totalByLevel: totalByLevel.map((item) => ({
      institutionTypeCode: item.institutionTypeCode,
      institutionTypeName: item.institutionTypeName,
      count: typeof item._count === "object" ? item._count.id ?? 0 : 0
    })),
    totalRegions,
    latestSnapshotDate: latestSnapshot?.snapshotDate.toISOString() ?? null,
    snapshotDates: snapshotDateRows.map((item) => item.snapshotDate.toISOString()),
    specialities: specialities
      .filter(
        (item): item is { canonicalCode: string; canonicalName: string; canonicalFieldCode: string } =>
          Boolean(item.canonicalCode && item.canonicalName && item.canonicalFieldCode)
      )
      .map((item) => ({
        value: item.canonicalCode,
        label: `${item.canonicalCode} ${item.canonicalName}`,
        fieldCode: item.canonicalFieldCode
      })),
    educationLevels: educationLevelOptions,
    entryBases: entryBases.map((entryBase) => ({
      value: String(entryBase.id),
      label: entryBase.name
    })),
    studyForms: studyForms.map((studyForm) => ({
      value: String(studyForm.id),
      label: studyForm.name
    }))
  }, { headers: cacheHeaders });
}
