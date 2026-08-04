import { performance } from "node:perf_hooks";
import { prisma } from "@/lib/db";
import { ensureDashboardApiCacheTable, getStandardDashboardCacheKey, writeDashboardApiCache, type DashboardCacheScope } from "@/lib/dashboard/api-cache";
import { getDashboardCharts, getDashboardDynamics, getDashboardSummary, getFilterOptions } from "@/lib/dashboard/queries";
import type { DashboardFiltersInput } from "@/lib/edbo/schemas";

const scopes: DashboardCacheScope[] = ["summary", "charts", "dynamics"];

function isAllMode() {
  return process.argv.includes("--all");
}

async function buildPayload(scope: DashboardCacheScope, filters: Partial<DashboardFiltersInput>) {
  if (scope === "summary") return getDashboardSummary(filters);
  if (scope === "charts") return getDashboardCharts(filters);
  return { dynamics: await getDashboardDynamics(filters) };
}

async function warmCache(scope: DashboardCacheScope, filters: Partial<DashboardFiltersInput>) {
  const cacheKey = getStandardDashboardCacheKey(scope, filters);
  if (!cacheKey) return;

  const started = performance.now();
  const payload = await buildPayload(scope, filters);
  await writeDashboardApiCache(scope, cacheKey, payload);
  const elapsed = Math.round(performance.now() - started);
  const label =
    filters.datasetType === "students"
      ? `${filters.datasetType}:${filters.snapshotDate}`
      : `${filters.datasetType}:${filters.year}`;
  console.log(`Cached ${scope} for ${label} in ${elapsed} ms`);
}

async function main() {
  const all = isAllMode();
  await ensureDashboardApiCacheTable();
  const options = await getFilterOptions();
  const studentDates = all ? options.dates : options.dates.slice(0, 1);
  const entrantsYears = all ? options.yearsByDataset.entrants : options.yearsByDataset.entrants.slice(0, 1);
  const graduateYears = all ? options.yearsByDataset.graduates : options.yearsByDataset.graduates.slice(0, 1);
  const filterSets: Array<Partial<DashboardFiltersInput>> = [
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

  console.log(`Warming dashboard API cache for ${filterSets.length} standard filter set(s).`);
  for (const filters of filterSets) {
    for (const scope of scopes) {
      await warmCache(scope, filters);
    }
  }
}

main()
  .catch((error) => {
    console.error("Dashboard API cache refresh failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
