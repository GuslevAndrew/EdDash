import { performance } from "node:perf_hooks";
import {
  FILTER_OPTIONS_CACHE_KEY,
  cleanupDashboardApiCache,
  ensureDashboardApiCacheTable,
  getStandardDashboardCacheKey,
  writeDashboardApiCache,
  type DashboardCacheScope
} from "@/lib/dashboard/api-cache";
import { getDashboardCharts, getDashboardDynamics, getDashboardSummary, getFilterOptions } from "@/lib/dashboard/queries";
import type { DashboardFiltersInput } from "@/lib/edbo/schemas";
import { GET as getInstitutionFilters } from "@/app/api/institutions/filters/route";
import { GET as getInstitutionMap } from "@/app/api/institutions/map/route";
import { GET as getInstitutionMapDynamics } from "@/app/api/institutions/map/dynamics/route";
import { GET as getInstitutionTable } from "@/app/api/institutions/table/route";

type DashboardDataCacheScope = Extract<DashboardCacheScope, "summary" | "charts" | "dynamics">;
type InstitutionDataCacheScope = Extract<
  DashboardCacheScope,
  "institutionsFilters" | "institutionsMap" | "institutionsMapDynamics" | "institutionsTable"
>;

const DEFAULT_SCOPES: DashboardDataCacheScope[] = ["summary", "charts", "dynamics"];
const DEFAULT_INSTITUTION_SCOPES: InstitutionDataCacheScope[] = [
  "institutionsFilters",
  "institutionsMap",
  "institutionsMapDynamics",
  "institutionsTable"
];

export type DashboardCacheWarmupEntry = {
  scope: DashboardCacheScope;
  label: string;
  cacheKey: string;
  elapsedMs: number;
  status: "cached" | "skipped" | "failed";
  errorMessage?: string;
};

export type DashboardCacheWarmupResult = {
  all: boolean;
  filterSetsCount: number;
  elapsedMs: number;
  entries: DashboardCacheWarmupEntry[];
};

export type DashboardCacheWarmupOptions = {
  all?: boolean;
  includeFilters?: boolean;
  scopes?: DashboardDataCacheScope[];
  includeInstitutions?: boolean;
  institutionScopes?: InstitutionDataCacheScope[];
};

function getFilterLabel(filters: Partial<DashboardFiltersInput>): string {
  return filters.datasetType === "students"
    ? `${filters.datasetType}:${filters.snapshotDate}`
    : `${filters.datasetType}:${filters.year ?? filters.years?.[0]}`;
}

async function buildPayload(scope: DashboardDataCacheScope, filters: Partial<DashboardFiltersInput>) {
  if (scope === "summary") return getDashboardSummary(filters);
  if (scope === "charts") return getDashboardCharts(filters);
  return { dynamics: await getDashboardDynamics(filters) };
}

function buildInstitutionQueries(options: Awaited<ReturnType<typeof getFilterOptions>>, all: boolean): string[] {
  const dates = all ? options.dates : options.dates.slice(0, 1);
  const levelSets = all ? ["", "level=1", "level=9"] : ["", "level=1"];

  return dates.flatMap((date) =>
    levelSets.map((levelQuery) => {
      const params = new URLSearchParams(levelQuery);
      params.set("date", date);
      return params.toString();
    })
  );
}

async function warmInstitutionEndpoint(scope: InstitutionDataCacheScope, query: string): Promise<void> {
  const url = query ? `http://localhost/api/institutions/cache-warmup?${query}` : "http://localhost/api/institutions/cache-warmup";
  let response: Response;

  if (scope === "institutionsFilters") {
    response = await getInstitutionFilters(new Request(url));
  } else if (scope === "institutionsMap") {
    response = await getInstitutionMap(new Request(url));
  } else if (scope === "institutionsMapDynamics") {
    const params = new URLSearchParams(query);
    params.delete("date");
    response = await getInstitutionMapDynamics(new Request(`http://localhost/api/institutions/cache-warmup?${params.toString()}`));
  } else {
    const params = new URLSearchParams(query);
    params.set("sort", "institution");
    params.set("direction", "asc");
    params.set("pageSize", "25");
    response = await getInstitutionTable(new Request(`http://localhost/api/institutions/cache-warmup?${params.toString()}`));
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${response.status} ${body}`.trim());
  }
}

function buildStandardFilterSets(
  options: Awaited<ReturnType<typeof getFilterOptions>>,
  all: boolean
): Array<Partial<DashboardFiltersInput>> {
  const studentDates = all ? options.dates : options.dates.slice(0, 1);
  const entrantsYears = all ? options.yearsByDataset.entrants : options.yearsByDataset.entrants.slice(0, 1);
  const graduateYears = all ? options.yearsByDataset.graduates : options.yearsByDataset.graduates.slice(0, 1);

  return [
    ...studentDates.map((date) => ({
      datasetType: "students" as const,
      snapshotDate: date,
      snapshotDates: [date]
    })),
    ...entrantsYears.map((year) => ({
      datasetType: "entrants" as const,
      year,
      years: [year]
    })),
    ...graduateYears.map((year) => ({
      datasetType: "graduates" as const,
      year,
      years: [year]
    }))
  ];
}

export async function warmDashboardApiCache({
  all = false,
  includeFilters = true,
  scopes = DEFAULT_SCOPES,
  includeInstitutions = false,
  institutionScopes = DEFAULT_INSTITUTION_SCOPES
}: DashboardCacheWarmupOptions = {}): Promise<DashboardCacheWarmupResult> {
  const started = performance.now();
  const entries: DashboardCacheWarmupEntry[] = [];

  await ensureDashboardApiCacheTable();
  await cleanupDashboardApiCache();
  const options = await getFilterOptions();

  if (includeFilters) {
    const filterStarted = performance.now();
    try {
      await writeDashboardApiCache("filters", FILTER_OPTIONS_CACHE_KEY, options);
      entries.push({
        scope: "filters",
        label: "filters:all",
        cacheKey: FILTER_OPTIONS_CACHE_KEY,
        elapsedMs: Math.round(performance.now() - filterStarted),
        status: "cached"
      });
    } catch (error) {
      entries.push({
        scope: "filters",
        label: "filters:all",
        cacheKey: FILTER_OPTIONS_CACHE_KEY,
        elapsedMs: Math.round(performance.now() - filterStarted),
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const filterSets = buildStandardFilterSets(options, all);

  for (const filters of filterSets) {
    for (const scope of scopes) {
      const cacheKey = getStandardDashboardCacheKey(scope, filters);
      const label = getFilterLabel(filters);

      if (!cacheKey) {
        entries.push({ scope, label, cacheKey: "", elapsedMs: 0, status: "skipped" });
        continue;
      }

      const entryStarted = performance.now();
      try {
        const payload = await buildPayload(scope, filters);
        await writeDashboardApiCache(scope, cacheKey, payload);
        entries.push({
          scope,
          label,
          cacheKey,
          elapsedMs: Math.round(performance.now() - entryStarted),
          status: "cached"
        });
      } catch (error) {
        entries.push({
          scope,
          label,
          cacheKey,
          elapsedMs: Math.round(performance.now() - entryStarted),
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  if (includeInstitutions) {
    const institutionQueries = buildInstitutionQueries(options, all);

    for (const scope of institutionScopes) {
      const queries = scope === "institutionsFilters" ? [""] : institutionQueries;
      for (const query of queries) {
        const entryStarted = performance.now();
        const label = query ? `${scope}:${query}` : `${scope}:default`;
        try {
          await warmInstitutionEndpoint(scope, query);
          entries.push({
            scope,
            label,
            cacheKey: label,
            elapsedMs: Math.round(performance.now() - entryStarted),
            status: "cached"
          });
        } catch (error) {
          entries.push({
            scope,
            label,
            cacheKey: label,
            elapsedMs: Math.round(performance.now() - entryStarted),
            status: "failed",
            errorMessage: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  }

  return {
    all,
    filterSetsCount: filterSets.length,
    elapsedMs: Math.round(performance.now() - started),
    entries
  };
}
