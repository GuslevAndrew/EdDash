import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCanonicalEducationLevelName } from "@/lib/education-levels/canonical";

const defaultPageSize = 25;
const maxPageSize = 250;
const sortKeys = ["institution", "parent", "region", "students", "foundationYear", "ownership"] as const;
const sortDirections = ["asc", "desc"] as const;

type SortKey = (typeof sortKeys)[number];
type SortDirection = (typeof sortDirections)[number];

type InstitutionSortRef = {
  id: number;
  name: string;
  externalId: string | null;
  parentExternalId: string | null;
  foundationYear: string | null;
  ownership: string | null;
  website: string | null;
  blockedAt: string | null;
  region: {
    name: string;
  };
};

const tableQuerySchema = z.object({
  level: z.array(z.enum(["1", "9"])).default([]),
  region: z.array(z.coerce.number().int().positive()).default([]),
  institution: z.array(z.coerce.number().int().positive()).default([]),
  date: z.string().optional(),
  field: z.array(z.string().min(1)).default([]),
  speciality: z.array(z.string().min(1)).default([]),
  educationLevel: z.array(z.string().min(1)).default([]),
  entryBase: z.array(z.coerce.number().int().positive()).default([]),
  studyForm: z.array(z.coerce.number().int().positive()).default([]),
  showBlocked: z.enum(["0", "1"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(maxPageSize).default(defaultPageSize),
  sort: z.enum(sortKeys).default("institution"),
  direction: z.enum(sortDirections).default("asc")
});

function getArrayParam(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).filter((value) => value.trim());
}

function parseTableQuery(params: URLSearchParams) {
  return tableQuerySchema.parse({
    level: getArrayParam(params, "level"),
    region: getArrayParam(params, "region"),
    institution: getArrayParam(params, "institution"),
    date: params.get("date") ?? undefined,
    field: getArrayParam(params, "field"),
    speciality: getArrayParam(params, "speciality"),
    educationLevel: getArrayParam(params, "educationLevel"),
    entryBase: getArrayParam(params, "entryBase"),
    studyForm: getArrayParam(params, "studyForm"),
    showBlocked: params.get("showBlocked") ?? undefined,
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    sort: params.get("sort") ?? undefined,
    direction: params.get("direction") ?? undefined
  });
}

function institutionOrderBy(sortKey: SortKey, direction: SortDirection): Prisma.InstitutionOrderByWithRelationInput[] {
  if (sortKey === "region") return [{ region: { name: direction } }, { name: "asc" }];
  if (sortKey === "foundationYear") return [{ foundationYear: direction }, { name: "asc" }];
  if (sortKey === "ownership") return [{ ownership: direction }, { name: "asc" }];
  return [{ name: direction }];
}

function institutionSortKey(name: string): string {
  return name.trim().replace(/^[\s"'«»„“”]+/, "");
}

function textSortValue(value: string | null | undefined): string {
  return institutionSortKey(value?.trim() || "");
}

function compareText(first: string, second: string): number {
  return first.localeCompare(second, "uk", { sensitivity: "base", numeric: true });
}

function compareInstitutionRefs(
  first: InstitutionSortRef,
  second: InstitutionSortRef,
  sortKey: SortKey,
  direction: SortDirection,
  parentNamesByExternalId: Map<string, string>,
  studentsByInstitution: Map<number, number>
): number {
  const multiplier = direction === "asc" ? 1 : -1;
  let result = 0;

  if (sortKey === "students") {
    result = (studentsByInstitution.get(first.id) ?? 0) - (studentsByInstitution.get(second.id) ?? 0);
  } else if (sortKey === "parent") {
    result = compareText(
      textSortValue(first.parentExternalId ? parentNamesByExternalId.get(first.parentExternalId) : ""),
      textSortValue(second.parentExternalId ? parentNamesByExternalId.get(second.parentExternalId) : "")
    );
  } else if (sortKey === "region") {
    result = compareText(textSortValue(first.region.name), textSortValue(second.region.name));
  } else if (sortKey === "foundationYear") {
    result = compareText(textSortValue(first.foundationYear), textSortValue(second.foundationYear));
  } else if (sortKey === "ownership") {
    result = compareText(textSortValue(first.ownership), textSortValue(second.ownership));
  } else {
    result = compareText(textSortValue(first.name), textSortValue(second.name));
  }

  if (result === 0 && sortKey !== "institution") {
    result = compareText(textSortValue(first.name), textSortValue(second.name));
  }

  return result * multiplier;
}

function normalizeWebsite(value: string | null): string | null {
  const rawValue = value?.trim();
  if (!rawValue) return null;
  const withoutSpaces = rawValue.replace(/\s+/g, "");
  const withSingleProtocol = withoutSpaces.replace(/^https?:\/\/(https?:\/\/)/i, "$1");
  const candidate = /^https?:\/\//i.test(withSingleProtocol) ? withSingleProtocol : `https://${withSingleProtocol}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function displayShortName(value: string | null): string | null {
  const normalized = value?.trim();
  if (!normalized || normalized === "." || normalized === "-") return null;
  return normalized;
}

export async function GET(request: Request) {
  const parsed = parseTableQuery(new URL(request.url).searchParams);
  const filteredInstitutionTypeCodes = parsed.level.length ? parsed.level : ["1", "9"];
  const showBlocked = parsed.showBlocked === "1";
  const needsFullInstitutionSort = parsed.sort === "students" || parsed.sort === "parent";
  const requestedDate = parsed.date && !Number.isNaN(new Date(parsed.date).getTime()) ? new Date(parsed.date) : null;

  const where: Prisma.InstitutionWhereInput = {
    institutionTypeCode: { in: filteredInstitutionTypeCodes },
    regionId: parsed.region.length ? { in: parsed.region } : undefined,
    id: parsed.institution.length ? { in: parsed.institution } : undefined,
    blockedAt: showBlocked ? undefined : null
  };
  const institutionSelect = {
    id: true,
    name: true,
    externalId: true,
    parentExternalId: true,
    foundationYear: true,
    ownership: true,
    website: true,
    blockedAt: true,
    region: { select: { name: true } }
  } satisfies Prisma.InstitutionSelect;

  const [latestSnapshot, educationLevels, total, filteredInstitutionRefs] = await Promise.all([
    prisma.studentSnapshot.findFirst({ orderBy: { snapshotDate: "desc" }, select: { snapshotDate: true } }),
    prisma.educationLevel.findMany({ select: { id: true, name: true } }),
    prisma.institution.count({ where }),
    prisma.institution.findMany({
      where,
      select: institutionSelect,
      orderBy: needsFullInstitutionSort ? undefined : institutionOrderBy(parsed.sort, parsed.direction),
      skip: needsFullInstitutionSort ? undefined : (parsed.page - 1) * parsed.pageSize,
      take: needsFullInstitutionSort ? undefined : parsed.pageSize
    })
  ]);

  const selectedSnapshotDate = requestedDate ?? latestSnapshot?.snapshotDate ?? null;
  const selectedEducationLevelIds = educationLevels
    .filter((item) => parsed.educationLevel.includes(getCanonicalEducationLevelName(item.name)))
    .map((item) => item.id);

  const parentExternalIds = [
    ...new Set(
      filteredInstitutionRefs
        .map((institution) => institution.parentExternalId)
        .filter((id): id is string => Boolean(id))
        .filter((id) => !filteredInstitutionRefs.some((institution) => institution.externalId === id))
    )
  ];
  const parentInstitutions = parentExternalIds.length
    ? await prisma.institution.findMany({
        where: { externalId: { in: parentExternalIds } },
        select: { externalId: true, name: true, website: true, blockedAt: true }
      })
    : [];
  const parentNamesByExternalId = new Map([
    ...filteredInstitutionRefs
      .filter((institution) => institution.externalId)
      .map((institution) => [institution.externalId ?? "", institution.name] as const),
    ...parentInstitutions
      .filter((institution) => institution.externalId)
      .map((institution) => [institution.externalId ?? "", institution.name] as const)
  ]);

  const studentTotals = filteredInstitutionRefs.length && selectedSnapshotDate
    ? await prisma.studentSnapshot.groupBy({
        by: ["institutionId"],
        where: {
          snapshotDate: selectedSnapshotDate,
          institutionId: { in: filteredInstitutionRefs.map((institution) => institution.id) },
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
      })
    : [];
  const studentsByInstitution = new Map(
    studentTotals.map((item) => [item.institutionId, item._sum.studentsCount ?? 0] as const)
  );
  const sortedInstitutionRefs = needsFullInstitutionSort
    ? [...filteredInstitutionRefs].sort((first, second) =>
        compareInstitutionRefs(first, second, parsed.sort, parsed.direction, parentNamesByExternalId, studentsByInstitution)
      )
    : filteredInstitutionRefs;
  const pageInstitutionIds = sortedInstitutionRefs
    .slice(needsFullInstitutionSort ? (parsed.page - 1) * parsed.pageSize : 0, needsFullInstitutionSort ? parsed.page * parsed.pageSize : sortedInstitutionRefs.length)
    .map((institution) => institution.id);
  const pageInstitutionOrder = new Map(pageInstitutionIds.map((id, index) => [id, index] as const));
  const institutions = pageInstitutionIds.length
    ? (
        await prisma.institution.findMany({
          where: { id: { in: pageInstitutionIds } },
          select: {
            id: true,
            name: true,
            shortName: true,
            externalId: true,
            parentExternalId: true,
            foundationYear: true,
            ownership: true,
            settlement: true,
            address: true,
            phone: true,
            email: true,
            website: true,
            blockedAt: true,
            region: { select: { name: true } }
          }
        })
      ).sort((first, second) => (pageInstitutionOrder.get(first.id) ?? 0) - (pageInstitutionOrder.get(second.id) ?? 0))
    : [];
  const parentsByExternalId = new Map([
    ...institutions
      .filter((institution) => institution.externalId)
      .map((institution) => [institution.externalId ?? "", { name: institution.name, website: institution.website, blockedAt: institution.blockedAt }] as const),
    ...parentInstitutions
      .filter((institution) => institution.externalId)
      .map((institution) => [institution.externalId ?? "", { name: institution.name, website: institution.website, blockedAt: institution.blockedAt }] as const)
  ]);

  return NextResponse.json({
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
    rows: institutions.map((institution, index) => {
      const parent = institution.parentExternalId && institution.parentExternalId !== institution.externalId
        ? parentsByExternalId.get(institution.parentExternalId) ?? null
        : null;
      return {
        id: institution.id,
        rowNumber: (parsed.page - 1) * parsed.pageSize + index + 1,
        name: institution.name,
        shortName: displayShortName(institution.shortName),
        website: normalizeWebsite(institution.website),
        blockedAt: institution.blockedAt,
        parent: parent
          ? {
              name: parent.name,
              website: normalizeWebsite(parent.website),
              blockedAt: parent.blockedAt
            }
          : null,
        region: institution.region.name,
        settlement: institution.settlement,
        students: studentsByInstitution.get(institution.id) ?? null,
        foundationYear: institution.foundationYear,
        ownership: institution.ownership,
        address: institution.address,
        phone: institution.phone,
        email: institution.email
      };
    })
  });
}
