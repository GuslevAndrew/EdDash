import { performance } from "node:perf_hooks";
import {
  FILTER_OPTIONS_CACHE_KEY,
  ensureDashboardApiCacheTable,
  getStandardDashboardCacheKey,
  writeDashboardApiCache,
  type DashboardCacheScope
} from "@/lib/dashboard/api-cache";
import { getDashboardCharts, getDashboardDynamics, getDashboardSummary, getFilterOptions } from "@/lib/dashboard/queries";
import type { DashboardFiltersInput } from "@/lib/edbo/schemas";

type DashboardDataCacheScope = Extract<DashboardCacheScope, "summary" | "charts" | "dynamics">;

const DEFAULT_SCOPES: DashboardDataCacheScope[] = ["summary", "charts", "dynamics"];

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
  scopes = DEFAULT_SCOPES
}: DashboardCacheWarmupOptions = {}): Promise<DashboardCacheWarmupResult> {
  const started = performance.now();
  const entries: DashboardCacheWarmupEntry[] = [];

  await ensureDashboardApiCacheTable();
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

  return {
    all,
    filterSetsCount: filterSets.length,
    elapsedMs: Math.round(performance.now() - started),
    entries
  };
}
