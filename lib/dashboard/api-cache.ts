import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { DashboardFiltersInput } from "@/lib/edbo/schemas";

export type DashboardCacheScope =
  | "filters"
  | "summary"
  | "charts"
  | "dynamics"
  | "institutionsFilters"
  | "institutionsMap"
  | "institutionsMapDynamics"
  | "institutionsTable";

const DASHBOARD_CACHE_VERSION = 2;

export const FILTER_OPTIONS_CACHE_KEY = JSON.stringify({ scope: "filters", version: DASHBOARD_CACHE_VERSION });

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const EMPTY_ARRAY_FILTERS = [
  "regionIds",
  "institutionIds",
  "institutionTypeCodes",
  "fieldCodes",
  "specialityCodes",
  "educationLevelNames",
  "entryBaseIds",
  "studyFormIds"
] as const;
const EMPTY_VALUE_FILTERS = [
  "regionId",
  "institutionId",
  "institutionTypeCode",
  "fieldCode",
  "specialityCode",
  "specialityId",
  "educationLevelName",
  "educationLevelId",
  "entryBaseId",
  "studyFormId"
] as const;

type CacheRow<T> = {
  payload: T;
};

export async function ensureDashboardApiCacheTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "DashboardApiCache" (
      "cacheKey" TEXT PRIMARY KEY,
      "scope" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "DashboardApiCache_scope_expiresAt_idx"
      ON "DashboardApiCache" ("scope", "expiresAt")
  `;
}

export async function cleanupDashboardApiCache() {
  try {
    await ensureDashboardApiCacheTable();
    await prisma.$executeRaw`
      DELETE FROM "DashboardApiCache"
      WHERE "expiresAt" <= NOW()
        OR (
          "scope" IN ('filters', 'summary', 'charts', 'dynamics', 'institutionsFilters', 'institutionsMapDynamics')
          AND "cacheKey" NOT LIKE '%"version":2%'
        )
    `;
  } catch (error) {
    console.error("dashboard api cache cleanup failed", error);
  }
}

function isEmptyArrayFilter(value: unknown): boolean {
  return !Array.isArray(value) || value.length === 0;
}

function hasOnlyOneSelectedStudentDate(filters: Partial<DashboardFiltersInput>): boolean {
  if (filters.datasetType && filters.datasetType !== "students") return false;
  if (!filters.snapshotDate) return false;
  if (filters.snapshotDates?.length && (filters.snapshotDates.length !== 1 || filters.snapshotDates[0] !== filters.snapshotDate)) return false;
  return true;
}

function hasOnlyOneSelectedYear(filters: Partial<DashboardFiltersInput>): boolean {
  if (filters.datasetType !== "entrants" && filters.datasetType !== "graduates") return false;
  if (!filters.year && !filters.years?.length) return false;
  const years = filters.years?.length ? filters.years : filters.year ? [filters.year] : [];
  return years.length === 1;
}

function hasNoExtraFilters(filters: Partial<DashboardFiltersInput>): boolean {
  if (filters.includeBlockedInstitutions) return false;
  for (const key of EMPTY_ARRAY_FILTERS) {
    if (!isEmptyArrayFilter(filters[key])) return false;
  }
  for (const key of EMPTY_VALUE_FILTERS) {
    if (filters[key]) return false;
  }
  return true;
}

export function getStandardDashboardCacheKey(scope: DashboardCacheScope, filters: Partial<DashboardFiltersInput>): string | null {
  if (!hasNoExtraFilters(filters)) return null;
  const datasetType = filters.datasetType ?? "students";

  if (datasetType === "students") {
    if (!hasOnlyOneSelectedStudentDate(filters)) return null;
    return JSON.stringify({ scope, version: DASHBOARD_CACHE_VERSION, datasetType, snapshotDate: filters.snapshotDate });
  }

  if (!hasOnlyOneSelectedYear(filters)) return null;
  const year = filters.years?.length ? filters.years[0] : filters.year;
  return JSON.stringify({ scope, version: DASHBOARD_CACHE_VERSION, datasetType, year });
}

export async function readDashboardApiCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const rows = await prisma.$queryRaw<Array<CacheRow<T>>>`
      SELECT "payload"
      FROM "DashboardApiCache"
      WHERE "cacheKey" = ${cacheKey}
        AND "expiresAt" > NOW()
      LIMIT 1
    `;
    return rows[0]?.payload ?? null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2010") return null;
    return null;
  }
}

export async function writeDashboardApiCache(scope: DashboardCacheScope, cacheKey: string, payload: unknown) {
  try {
    await ensureDashboardApiCacheTable();
    const payloadJson = JSON.stringify(payload);
    await prisma.$executeRaw`
      INSERT INTO "DashboardApiCache" ("cacheKey", "scope", "payload", "expiresAt", "updatedAt")
      VALUES (${cacheKey}, ${scope}, ${payloadJson}::jsonb, ${new Date(Date.now() + CACHE_TTL_MS)}, NOW())
      ON CONFLICT ("cacheKey")
      DO UPDATE SET
        "payload" = EXCLUDED."payload",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = NOW()
    `;
  } catch (error) {
    console.error("dashboard api cache write failed", error);
  }
}
