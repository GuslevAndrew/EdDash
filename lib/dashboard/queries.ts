import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCanonicalEducationLevelName, getEducationLevelNameVariants } from "@/lib/education-levels/canonical";
import { INSTITUTION_TYPES } from "@/lib/edbo/constants";
import { formatCanonicalSpeciality } from "@/lib/specialities/canonical";
import { specialityCatalogSource } from "@/lib/specialities/catalog";
import { buildSnapshotWhere, buildYearlyOutcomeWhere } from "./filters";
import type { DashboardFiltersInput } from "@/lib/edbo/schemas";

type NamedTotal = { name: string; value: number };
type InstitutionDateTotal = NamedTotal & { series?: Array<{ label: string; value: number }> };
type RegionDateTotal = NamedTotal & {
  series?: Array<{ label: string; value: number }>;
  tone?: "default" | "warning";
  children?: Array<NamedTotal & { series?: Array<{ label: string; value: number }>; tone?: "selected" }>;
};
type ChildDateTotal = NonNullable<RegionDateTotal["children"]>[number];
type DynamicSeries = {
  id: string;
  name: string;
  points: Array<{ date: string; value: number }>;
};
type DynamicsBreakdownKey = "institutions" | "regions" | "fields" | "specialities" | "educationLevels" | "studyForms";
type SummaryCounts = {
  totalStudents: number;
  institutionsCount: number;
  specialitiesCount: number;
  regionsCount: number;
};

const MIN_COMPLETE_SNAPSHOT_ROWS = 10_000;

function formatFieldName(fieldCode?: string | null, fieldName?: string | null): string {
  const code = fieldCode?.trim();
  const name = fieldName?.trim();
  if (code && name) return `${code} ${name}`;
  return name || "Без галузі";
}

export async function getLastSuccessfulImport() {
  return prisma.importRun.findFirst({
    where: { status: "success" },
    orderBy: { finishedAt: "desc" }
  });
}

async function getCompleteSnapshotDates(): Promise<Date[]> {
  const dates = await prisma.studentSnapshot.groupBy({
    by: ["snapshotDate"],
    where: {
      institution: { blockedAt: null }
    },
    _count: { _all: true },
    orderBy: { snapshotDate: "desc" }
  });

  return dates
    .filter((item) => item._count._all >= MIN_COMPLETE_SNAPSHOT_ROWS)
    .map((item) => item.snapshotDate);
}

export async function getFilterOptions() {
  const [
    dateRows,
    years,
    regions,
    institutions,
    specialities,
    educationLevels,
    entryBases,
    studyForms
  ] = await prisma.$transaction([
    prisma.studentSnapshot.groupBy({
      by: ["snapshotDate"],
      where: {
        institution: { blockedAt: null }
      },
      _count: { _all: true },
      orderBy: { snapshotDate: "desc" }
    }),
    prisma.yearlyOutcome.groupBy({
      by: ["type", "year"],
      orderBy: [{ type: "asc" }, { year: "desc" }]
    }),
    prisma.region.findMany({ orderBy: { name: "asc" } }),
    prisma.institution.findMany({
      select: { id: true, name: true, institutionTypeCode: true, regionId: true },
      orderBy: { name: "asc" }
    }),
    prisma.speciality.findMany({
      where: { canonicalCode: { not: null }, canonicalName: { not: null }, canonicalFieldCode: { not: null } },
      distinct: ["canonicalCode"],
      select: { canonicalCode: true, canonicalName: true, canonicalFieldCode: true, canonicalFieldName: true },
      orderBy: [{ canonicalFieldCode: "asc" }, { canonicalCode: "asc" }]
    }),
    prisma.educationLevel.findMany({ orderBy: { name: "asc" } }),
    prisma.entryBase.findMany({ orderBy: { name: "asc" } }),
    prisma.studyForm.findMany({ where: { code: { not: "total" } }, orderBy: { name: "asc" } })
  ]);
  const dates = dateRows
    .filter((item) => (typeof item._count === "object" ? item._count._all ?? 0 : 0) >= MIN_COMPLETE_SNAPSHOT_ROWS)
    .map((item) => item.snapshotDate);
  return {
    dates: dates.map((date) => date.toISOString()),
    datesWithStudyForms: dates.map((date) => date.toISOString()),
    years: [...new Set(years.map((item) => item.year))].sort((first, second) => second - first),
    yearsByDataset: {
      entrants: years
        .filter((item) => item.type === "entrants")
        .map((item) => item.year)
        .sort((first, second) => second - first),
      graduates: years
        .filter((item) => item.type === "graduates")
        .map((item) => item.year)
        .sort((first, second) => second - first)
    },
    institutionTypes: [
      { code: INSTITUTION_TYPES.higher.code, name: "Заклади вищої освіти" },
      { code: INSTITUTION_TYPES.scientific.code, name: INSTITUTION_TYPES.scientific.name },
      { code: INSTITUTION_TYPES.professionalPreHigher.code, name: "Заклади фахової передвищої освіти" },
      { code: INSTITUTION_TYPES.postgraduate.code, name: INSTITUTION_TYPES.postgraduate.name }
    ],
    fields: specialityCatalogSource.fields,
    regions: [
      ...regions.filter((region) => region.name === "м. Київ"),
      ...regions.filter((region) => region.name !== "м. Київ").sort((first, second) => first.name.localeCompare(second.name, "uk"))
    ],
    institutions,
    specialities: specialities
      .filter(
        (item): item is {
          canonicalCode: string;
          canonicalName: string;
          canonicalFieldCode: string;
          canonicalFieldName: string;
        } => Boolean(item.canonicalCode && item.canonicalName && item.canonicalFieldCode && item.canonicalFieldName)
      )
      .map((item) => ({
        code: item.canonicalCode,
        name: item.canonicalName,
        fieldCode: item.canonicalFieldCode,
        fieldName: item.canonicalFieldName
      })),
    educationLevels: [
      ...new Map(
        educationLevels.map((item) => {
          const name = getCanonicalEducationLevelName(item.name);
          return [name, { name }];
        })
      ).values()
    ].sort((first, second) => first.name.localeCompare(second.name, "uk")),
    entryBases,
    studyForms
  };
}

async function yearlyTotalsByRelation(
  by: "institutionId" | "regionId" | "specialityId" | "educationLevelId",
  where: Prisma.YearlyOutcomeWhereInput,
  take?: number
): Promise<NamedTotal[]> {
  const grouped = await prisma.yearlyOutcome.groupBy({
    by: [by],
    where,
    _sum: { personsCount: true },
    orderBy: { _sum: { personsCount: "desc" } },
    ...(take ? { take } : {})
  });

  const ids = grouped.map((item) => item[by]);
  let names: Map<number, string>;
  if (by === "institutionId") {
    const rows = await prisma.institution.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    names = new Map(rows.map((row) => [row.id, row.name]));
  } else if (by === "regionId") {
    const rows = await prisma.region.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    names = new Map(rows.map((row) => [row.id, row.name]));
  } else if (by === "specialityId") {
    const rows = await prisma.speciality.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true, name: true, canonicalCode: true, canonicalName: true }
    });
    names = new Map(rows.map((row) => [row.id, formatCanonicalSpeciality(row)]));
  } else {
    const rows = await prisma.educationLevel.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    names = new Map(rows.map((row) => [row.id, row.name]));
  }

  return grouped.map((item) => ({
    name: names.get(item[by]) ?? "Невідомо",
    value: item._sum.personsCount ?? 0
  }));
}

function getSelectedYears(filters: Partial<DashboardFiltersInput>): number[] {
  return [...new Set(filters.years?.length ? filters.years : filters.year ? [filters.year] : [])].sort((first, second) => second - first);
}

async function yearlyTotalsByRelationAcrossYears(
  by: "institutionId" | "regionId",
  where: Prisma.YearlyOutcomeWhereInput,
  years: number[],
  take?: number
): Promise<InstitutionDateTotal[]> {
  if (years.length <= 1) {
    return yearlyTotalsByRelation(by, {
      ...where,
      year: years[0] ?? where.year
    }, take);
  }

  const grouped = await prisma.yearlyOutcome.groupBy({
    by: [by, "year"],
    where: {
      ...where,
      year: { in: years }
    },
    _sum: { personsCount: true }
  });
  const ids = [...new Set(grouped.map((item) => item[by]))];
  const rows =
    by === "institutionId"
      ? await prisma.institution.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : await prisma.region.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const names = new Map(rows.map((row) => [row.id, row.name]));
  const totals = new Map<number, InstitutionDateTotal>();

  for (const item of grouped) {
    const id = item[by];
    const value = item._sum.personsCount ?? 0;
    const label = String(item.year);
    const current = totals.get(id) ?? { name: names.get(id) ?? "Невідомо", value: 0, series: [] };
    current.value += value;
    const seriesItem = current.series?.find((entry) => entry.label === label);
    if (seriesItem) {
      seriesItem.value += value;
    } else {
      current.series = [...(current.series ?? []), { label, value }];
    }
    totals.set(id, current);
  }

  const values = [...totals.values()].map((item) => {
    const valuesByYear = new Map((item.series ?? []).map((entry) => [entry.label, entry.value]));
    const series = years.map((year) => ({
      label: String(year),
      value: valuesByYear.get(String(year)) ?? 0
    }));
    return {
      ...item,
      value: series[0]?.value ?? 0,
      series
    };
  });

  return values.sort((first, second) => second.value - first.value).slice(0, take);
}

async function yearlyGrandTotalAcrossYears(where: Prisma.YearlyOutcomeWhereInput, years: number[]): Promise<InstitutionDateTotal[]> {
  if (years.length <= 1) {
    const total = await prisma.yearlyOutcome.aggregate({
      where: {
        ...where,
        year: years[0] ?? where.year
      },
      _sum: { personsCount: true }
    });

    return [{ name: "Разом", value: total._sum.personsCount ?? 0 }];
  }

  const grouped = await prisma.yearlyOutcome.groupBy({
    by: ["year"],
    where: {
      ...where,
      year: { in: years }
    },
    _sum: { personsCount: true }
  });
  const valuesByYear = new Map(grouped.map((item) => [String(item.year), item._sum.personsCount ?? 0]));
  const series = years.map((year) => ({
    label: String(year),
    value: valuesByYear.get(String(year)) ?? 0
  }));

  return [{ name: "Разом", value: series[0]?.value ?? 0, series }];
}

async function yearlyTotalsByRegionAcrossYears(
  baseWhere: Prisma.YearlyOutcomeWhereInput,
  selectedInstitutionWhere: Prisma.YearlyOutcomeWhereInput | null,
  years: number[],
  selectedRegionIds: number[],
  take?: number
): Promise<RegionDateTotal[]> {
  const grouped = await prisma.yearlyOutcome.groupBy({
    by: ["regionId", "year"],
    where: {
      ...baseWhere,
      year: years.length ? { in: years } : baseWhere.year
    },
    _sum: { personsCount: true }
  });
  const selectedInstitutionGrouped = selectedInstitutionWhere
    ? await prisma.yearlyOutcome.groupBy({
        by: ["regionId", "institutionId", "year"],
        where: {
          ...selectedInstitutionWhere,
          year: years.length ? { in: years } : selectedInstitutionWhere.year
        },
        _sum: { personsCount: true }
      })
    : [];

  const regionIds = [...new Set([...grouped.map((item) => item.regionId), ...selectedInstitutionGrouped.map((item) => item.regionId)])];
  const institutionIds = [...new Set(selectedInstitutionGrouped.map((item) => item.institutionId))];
  const [regions, institutions] = await Promise.all([
    prisma.region.findMany({ where: { id: { in: regionIds } }, select: { id: true, name: true } }),
    institutionIds.length
      ? prisma.institution.findMany({ where: { id: { in: institutionIds } }, select: { id: true, name: true } })
      : Promise.resolve([])
  ]);

  const regionNames = new Map(regions.map((item) => [item.id, item.name]));
  const institutionNames = new Map(institutions.map((item) => [item.id, item.name]));
  const selectedRegionSet = new Set(selectedRegionIds);
  const valuesByRegion = new Map<number, Map<string, number>>();

  for (const item of grouped) {
    const yearKey = String(item.year);
    const regionMap = valuesByRegion.get(item.regionId) ?? new Map<string, number>();
    regionMap.set(yearKey, (regionMap.get(yearKey) ?? 0) + (item._sum.personsCount ?? 0));
    valuesByRegion.set(item.regionId, regionMap);
  }

  const selectedInstitutionsByRegion = new Map<number, Map<number, Map<string, number>>>();
  for (const item of selectedInstitutionGrouped) {
    const yearKey = String(item.year);
    const institutionMap = selectedInstitutionsByRegion.get(item.regionId) ?? new Map<number, Map<string, number>>();
    const yearMap = institutionMap.get(item.institutionId) ?? new Map<string, number>();
    yearMap.set(yearKey, (yearMap.get(yearKey) ?? 0) + (item._sum.personsCount ?? 0));
    institutionMap.set(item.institutionId, yearMap);
    selectedInstitutionsByRegion.set(item.regionId, institutionMap);
  }

  const selectedYears = years.length ? years : [...new Set(grouped.map((item) => item.year))].sort((first, second) => second - first);
  const buildSeries = (valuesByYear: Map<string, number>) =>
    selectedYears.length > 1
      ? selectedYears.map((year) => ({
          label: String(year),
          value: valuesByYear.get(String(year)) ?? 0
        }))
      : undefined;
  const getValue = (valuesByYear: Map<string, number>) => {
    if (!selectedYears.length) return [...valuesByYear.values()].reduce((sum, value) => sum + value, 0);
    const latestValue = valuesByYear.get(String(selectedYears[0])) ?? 0;
    if (latestValue) return latestValue;
    return [...valuesByYear.values()].reduce((sum, value) => sum + value, 0);
  };

  return [...valuesByRegion.entries()]
    .map(([regionId, valuesByYear]) => {
      const institutionChildren = selectedInstitutionsByRegion.get(regionId);
      const children = institutionChildren
        ? [...institutionChildren.entries()]
            .map(([institutionId, institutionValues]) => ({
              name: institutionNames.get(institutionId) ?? "Невідомий заклад освіти",
              value: getValue(institutionValues),
              series: buildSeries(institutionValues),
              tone: "selected" as const
            }))
            .sort((first, second) => second.value - first.value)
        : [];
      const isSelectedRegion = selectedRegionSet.has(regionId);
      const hasSelectedInstitutions = children.length > 0;

      return {
        name: regionNames.get(regionId) ?? "Без регіону",
        value: getValue(valuesByYear),
        series: buildSeries(valuesByYear),
        tone: isSelectedRegion || hasSelectedInstitutions ? ("warning" as const) : ("default" as const),
        children
      };
    })
    .sort((first, second) => {
      const firstSelected = first.tone === "warning";
      const secondSelected = second.tone === "warning";
      if (firstSelected !== secondSelected) return firstSelected ? -1 : 1;
      return second.value - first.value;
    })
    .slice(0, take);
}

async function totalsByRelation(
  by: "institutionId" | "regionId" | "specialityId" | "educationLevelId",
  where: Prisma.StudentSnapshotWhereInput,
  take?: number
): Promise<NamedTotal[]> {
  const grouped = await prisma.studentSnapshot.groupBy({
    by: [by],
    where,
    _sum: { studentsCount: true },
    orderBy: { _sum: { studentsCount: "desc" } },
    ...(take ? { take } : {})
  });

  const ids = grouped.map((item) => item[by]);
  let names: Map<number, string>;
  if (by === "institutionId") {
    const rows = await prisma.institution.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    names = new Map(rows.map((row) => [row.id, row.name]));
  } else if (by === "regionId") {
    const rows = await prisma.region.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    names = new Map(rows.map((row) => [row.id, row.name]));
  } else if (by === "specialityId") {
    const rows = await prisma.speciality.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true, name: true, canonicalCode: true, canonicalName: true }
    });
    names = new Map(rows.map((row) => [row.id, formatCanonicalSpeciality(row)]));
  } else {
    const rows = await prisma.educationLevel.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    names = new Map(rows.map((row) => [row.id, row.name]));
  }

  return grouped.map((item) => ({
    name: names.get(item[by]) ?? "Невідомо",
    value: item._sum.studentsCount ?? 0
  }));
}

async function totalsByInstitutionAcrossSnapshotDates(
  where: Prisma.StudentSnapshotWhereInput,
  snapshotDates: string[],
  take?: number
): Promise<InstitutionDateTotal[]> {
  const selectedDates = [...new Set(snapshotDates)]
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => second.getTime() - first.getTime());

  if (selectedDates.length <= 1) {
    return totalsByRelation("institutionId", {
      ...where,
      snapshotDate: selectedDates[0] ?? where.snapshotDate
    }, take);
  }

  const grouped = await prisma.studentSnapshot.groupBy({
    by: ["institutionId", "snapshotDate"],
    where: {
      ...where,
      snapshotDate: { in: selectedDates }
    },
    _sum: { studentsCount: true }
  });

  const institutionIds = [...new Set(grouped.map((item) => item.institutionId))];
  const institutions = await prisma.institution.findMany({
    where: { id: { in: institutionIds } },
    select: { id: true, name: true }
  });
  const names = new Map(institutions.map((item) => [item.id, item.name]));
  const groupedByInstitution = new Map<number, Map<string, number>>();

  for (const item of grouped) {
    const dateKey = item.snapshotDate.toISOString();
    const institutionMap = groupedByInstitution.get(item.institutionId) ?? new Map<string, number>();
    institutionMap.set(dateKey, item._sum.studentsCount ?? 0);
    groupedByInstitution.set(item.institutionId, institutionMap);
  }

  const sorted = [...groupedByInstitution.entries()]
    .map(([institutionId, valuesByDate]) => {
      const series = selectedDates.map((date) => ({
        label: date.toISOString(),
        value: valuesByDate.get(date.toISOString()) ?? 0
      }));
      const latestValue = series[0]?.value ?? 0;
      const totalValue = series.reduce((sum, item) => sum + item.value, 0);
      return {
        name: names.get(institutionId) ?? "Невідомо",
        value: latestValue || totalValue,
        series
      };
    })
    .sort((first, second) => second.value - first.value);

  return take ? sorted.slice(0, take) : sorted;
}

async function grandTotalAcrossSnapshotDates(
  where: Prisma.StudentSnapshotWhereInput,
  snapshotDates: string[]
): Promise<InstitutionDateTotal[]> {
  const selectedDates = [...new Set(snapshotDates)]
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => second.getTime() - first.getTime());

  if (selectedDates.length <= 1) {
    const total = await prisma.studentSnapshot.aggregate({
      where: {
        ...where,
        snapshotDate: selectedDates[0] ?? where.snapshotDate
      },
      _sum: { studentsCount: true }
    });

    return [{ name: "Разом", value: total._sum.studentsCount ?? 0 }];
  }

  const grouped = await prisma.studentSnapshot.groupBy({
    by: ["snapshotDate"],
    where: {
      ...where,
      snapshotDate: { in: selectedDates }
    },
    _sum: { studentsCount: true }
  });
  const valuesByDate = new Map(grouped.map((item) => [item.snapshotDate.toISOString(), item._sum.studentsCount ?? 0]));
  const series = selectedDates.map((date) => ({
    label: date.toISOString(),
    value: valuesByDate.get(date.toISOString()) ?? 0
  }));

  return [{ name: "Разом", value: series[0]?.value ?? 0, series }];
}

function getSelectedSnapshotDates(filters: Partial<DashboardFiltersInput>): Date[] {
  return [...new Set(filters.snapshotDates?.length ? filters.snapshotDates : filters.snapshotDate ? [filters.snapshotDate] : [])]
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => second.getTime() - first.getTime());
}

async function totalsByRegionAcrossSnapshotDates(
  baseWhere: Prisma.StudentSnapshotWhereInput,
  selectedInstitutionWhere: Prisma.StudentSnapshotWhereInput | null,
  snapshotDates: Date[],
  selectedRegionIds: number[]
): Promise<RegionDateTotal[]> {
  const where =
    snapshotDates.length > 1
      ? {
          ...baseWhere,
          snapshotDate: { in: snapshotDates }
        }
      : {
          ...baseWhere,
          snapshotDate: snapshotDates[0] ?? baseWhere.snapshotDate
        };

  const grouped = await prisma.studentSnapshot.groupBy({
    by: ["regionId", "snapshotDate"],
    where,
    _sum: { studentsCount: true }
  });

  const selectedInstitutionGrouped = selectedInstitutionWhere
    ? await prisma.studentSnapshot.groupBy({
        by: ["regionId", "institutionId", "snapshotDate"],
        where:
          snapshotDates.length > 1
            ? {
                ...selectedInstitutionWhere,
                snapshotDate: { in: snapshotDates }
              }
            : {
                ...selectedInstitutionWhere,
                snapshotDate: snapshotDates[0] ?? selectedInstitutionWhere.snapshotDate
              },
        _sum: { studentsCount: true }
      })
    : [];

  const regionIds = [...new Set([...grouped.map((item) => item.regionId), ...selectedInstitutionGrouped.map((item) => item.regionId)])];
  const institutionIds = [...new Set(selectedInstitutionGrouped.map((item) => item.institutionId))];
  const [regions, institutions] = await Promise.all([
    prisma.region.findMany({ where: { id: { in: regionIds } }, select: { id: true, name: true } }),
    institutionIds.length
      ? prisma.institution.findMany({ where: { id: { in: institutionIds } }, select: { id: true, name: true } })
      : Promise.resolve([])
  ]);

  const regionNames = new Map(regions.map((item) => [item.id, item.name]));
  const institutionNames = new Map(institutions.map((item) => [item.id, item.name]));
  const selectedRegionSet = new Set(selectedRegionIds);
  const valuesByRegion = new Map<number, Map<string, number>>();

  for (const item of grouped) {
    const dateKey = item.snapshotDate.toISOString();
    const regionMap = valuesByRegion.get(item.regionId) ?? new Map<string, number>();
    regionMap.set(dateKey, item._sum.studentsCount ?? 0);
    valuesByRegion.set(item.regionId, regionMap);
  }

  const selectedInstitutionsByRegion = new Map<number, Map<number, Map<string, number>>>();
  for (const item of selectedInstitutionGrouped) {
    const dateKey = item.snapshotDate.toISOString();
    const institutionMap = selectedInstitutionsByRegion.get(item.regionId) ?? new Map<number, Map<string, number>>();
    const dateMap = institutionMap.get(item.institutionId) ?? new Map<string, number>();
    dateMap.set(dateKey, item._sum.studentsCount ?? 0);
    institutionMap.set(item.institutionId, dateMap);
    selectedInstitutionsByRegion.set(item.regionId, institutionMap);
  }

  const buildSeries = (valuesByDate: Map<string, number>) =>
    snapshotDates.length > 1
      ? snapshotDates.map((date) => ({
          label: date.toISOString(),
          value: valuesByDate.get(date.toISOString()) ?? 0
        }))
      : undefined;

  const getValue = (valuesByDate: Map<string, number>) => {
    if (!snapshotDates.length) return [...valuesByDate.values()].reduce((sum, value) => sum + value, 0);
    const latestValue = valuesByDate.get(snapshotDates[0].toISOString()) ?? 0;
    if (latestValue) return latestValue;
    return [...valuesByDate.values()].reduce((sum, value) => sum + value, 0);
  };

  const allRegionIds = [...new Set([...valuesByRegion.keys(), ...selectedInstitutionsByRegion.keys()])];
  const effectiveSelectedRegionSet =
    selectedRegionSet.size > 0 && selectedRegionSet.size < allRegionIds.length ? selectedRegionSet : new Set<number>();

  return allRegionIds
    .map((regionId) => {
      const regionValues = valuesByRegion.get(regionId) ?? new Map<string, number>();
      const institutionEntries = [...(selectedInstitutionsByRegion.get(regionId)?.entries() ?? [])];
      const children = institutionEntries
        .map(([institutionId, institutionValues]) => ({
          name: institutionNames.get(institutionId) ?? "Невідомий заклад",
          value: getValue(institutionValues),
          series: buildSeries(institutionValues),
          tone: "selected" as const
        }))
        .sort((first, second) => second.value - first.value);

      const hasSelectedInstitutions = selectedInstitutionsByRegion.has(regionId);

      return {
        name: regionNames.get(regionId) ?? "Без регіону",
        value: getValue(regionValues),
        series: buildSeries(regionValues),
        tone: effectiveSelectedRegionSet.has(regionId) || hasSelectedInstitutions ? ("warning" as const) : ("default" as const),
        children
      };
    })
    .sort((first, second) => {
      const firstSelected = first.tone === "warning";
      const secondSelected = second.tone === "warning";
      if (firstSelected !== secondSelected) return firstSelected ? -1 : 1;
      return second.value - first.value;
    });
}

async function yearlyTotalsByFieldWithSelectedSpecialities(
  baseWhere: Prisma.YearlyOutcomeWhereInput,
  selectedSpecialityWhere: Prisma.YearlyOutcomeWhereInput | null,
  selectedFieldCodes: string[],
  years: number[]
): Promise<RegionDateTotal[]> {
  if (years.length > 1) {
    return yearlyTotalsByFieldWithSelectedSpecialitiesAcrossYears(baseWhere, selectedSpecialityWhere, selectedFieldCodes, years);
  }

  const grouped = await prisma.yearlyOutcome.groupBy({
    by: ["specialityId"],
    where: {
      ...baseWhere,
      year: years[0] ?? baseWhere.year
    },
    _sum: { personsCount: true }
  });
  const selectedGrouped = selectedSpecialityWhere
    ? await prisma.yearlyOutcome.groupBy({
        by: ["specialityId"],
        where: {
          ...selectedSpecialityWhere,
          year: years[0] ?? selectedSpecialityWhere.year
        },
        _sum: { personsCount: true }
      })
    : [];

  const specialityIds = [...new Set([...grouped.map((item) => item.specialityId), ...selectedGrouped.map((item) => item.specialityId)])];
  const specialities = await prisma.speciality.findMany({
    where: { id: { in: specialityIds } },
    select: {
      id: true,
      code: true,
      name: true,
      canonicalCode: true,
      canonicalName: true,
      fieldCode: true,
      fieldName: true,
      canonicalFieldCode: true,
      canonicalFieldName: true
    }
  });
  const specialityById = new Map(specialities.map((item) => [item.id, item]));
  const selectedFieldCodeSet = new Set(selectedFieldCodes);
  const fieldTotals = new Map<string, RegionDateTotal>();

  for (const item of grouped) {
    const speciality = specialityById.get(item.specialityId);
    const fieldCode = speciality?.canonicalFieldCode?.trim() ?? speciality?.fieldCode?.trim() ?? "unknown";
    const current = fieldTotals.get(fieldCode) ?? {
      name: formatFieldName(speciality?.canonicalFieldCode ?? speciality?.fieldCode, speciality?.canonicalFieldName ?? speciality?.fieldName),
      value: 0,
      tone: "default" as const,
      children: []
    };
    current.value += item._sum.personsCount ?? 0;
    fieldTotals.set(fieldCode, current);
  }

  const selectedChildrenByField = new Map<string, Map<string, NamedTotal & { tone: "selected" }>>();
  for (const item of selectedGrouped) {
    const speciality = specialityById.get(item.specialityId);
    const fieldCode = speciality?.canonicalFieldCode?.trim() ?? speciality?.fieldCode?.trim() ?? "unknown";
    const children = selectedChildrenByField.get(fieldCode) ?? new Map<string, NamedTotal & { tone: "selected" }>();
    const specialityKey = speciality?.canonicalCode ?? speciality?.code ?? String(item.specialityId);
    const child = children.get(specialityKey) ?? {
      name: speciality ? formatCanonicalSpeciality(speciality) : "Невідома спеціальність",
      value: 0,
      tone: "selected" as const
    };
    child.value += item._sum.personsCount ?? 0;
    children.set(specialityKey, child);
    selectedChildrenByField.set(fieldCode, children);
  }

  for (const [fieldCode, children] of selectedChildrenByField.entries()) {
    const speciality = specialities.find(
      (item) => (item.canonicalFieldCode?.trim() ?? item.fieldCode?.trim() ?? "unknown") === fieldCode
    );
    const current = fieldTotals.get(fieldCode) ?? {
      name: formatFieldName(speciality?.canonicalFieldCode ?? speciality?.fieldCode, speciality?.canonicalFieldName ?? speciality?.fieldName),
      value: 0,
      tone: "default" as const,
      children: []
    };
    current.children = [...children.values()].sort((first, second) => first.name.localeCompare(second.name, "uk", { numeric: true }));
    fieldTotals.set(fieldCode, current);
  }

  for (const [fieldCode, total] of fieldTotals.entries()) {
    if (selectedFieldCodeSet.has(fieldCode) || (total.children?.length ?? 0) > 0) {
      total.tone = "warning";
    }
  }

  return [...fieldTotals.entries()].sort(([firstCode], [secondCode]) => firstCode.localeCompare(secondCode, "uk", { numeric: true })).map(([, total]) => total);
}

async function yearlyTotalsByFieldWithSelectedSpecialitiesAcrossYears(
  baseWhere: Prisma.YearlyOutcomeWhereInput,
  selectedSpecialityWhere: Prisma.YearlyOutcomeWhereInput | null,
  selectedFieldCodes: string[],
  years: number[]
): Promise<RegionDateTotal[]> {
  const grouped = await prisma.yearlyOutcome.groupBy({
    by: ["specialityId", "year"],
    where: {
      ...baseWhere,
      year: { in: years }
    },
    _sum: { personsCount: true }
  });
  const selectedGrouped = selectedSpecialityWhere
    ? await prisma.yearlyOutcome.groupBy({
        by: ["specialityId", "year"],
        where: {
          ...selectedSpecialityWhere,
          year: { in: years }
        },
        _sum: { personsCount: true }
      })
    : [];

  const specialityIds = [...new Set([...grouped.map((item) => item.specialityId), ...selectedGrouped.map((item) => item.specialityId)])];
  const specialities = await prisma.speciality.findMany({
    where: { id: { in: specialityIds } },
    select: {
      id: true,
      code: true,
      name: true,
      canonicalCode: true,
      canonicalName: true,
      fieldCode: true,
      fieldName: true,
      canonicalFieldCode: true,
      canonicalFieldName: true
    }
  });
  const specialityById = new Map(specialities.map((item) => [item.id, item]));
  const selectedFieldCodeSet = new Set(selectedFieldCodes);
  const fieldTotals = new Map<string, RegionDateTotal>();

  function addSeriesValue(total: RegionDateTotal | ChildDateTotal, label: string, value: number) {
    const seriesItem = total.series?.find((entry) => entry.label === label);
    if (seriesItem) {
      seriesItem.value += value;
    } else {
      total.series = [...(total.series ?? []), { label, value }];
    }
  }

  for (const item of grouped) {
    const speciality = specialityById.get(item.specialityId);
    const fieldCode = speciality?.canonicalFieldCode?.trim() ?? speciality?.fieldCode?.trim() ?? "unknown";
    const value = item._sum.personsCount ?? 0;
    const label = String(item.year);
    const current = fieldTotals.get(fieldCode) ?? {
      name: formatFieldName(speciality?.canonicalFieldCode ?? speciality?.fieldCode, speciality?.canonicalFieldName ?? speciality?.fieldName),
      value: 0,
      tone: "default" as const,
      series: [],
      children: []
    };
    current.value += value;
    addSeriesValue(current, label, value);
    fieldTotals.set(fieldCode, current);
  }

  const selectedChildrenByField = new Map<string, Map<string, ChildDateTotal>>();
  for (const item of selectedGrouped) {
    const speciality = specialityById.get(item.specialityId);
    const fieldCode = speciality?.canonicalFieldCode?.trim() ?? speciality?.fieldCode?.trim() ?? "unknown";
    const value = item._sum.personsCount ?? 0;
    const label = String(item.year);
    const children = selectedChildrenByField.get(fieldCode) ?? new Map<string, ChildDateTotal>();
    const specialityKey = speciality?.canonicalCode ?? speciality?.code ?? String(item.specialityId);
    const child = children.get(specialityKey) ?? {
      name: speciality ? formatCanonicalSpeciality(speciality) : "Невідома спеціальність",
      value: 0,
      tone: "selected" as const,
      series: []
    };
    child.value += value;
    addSeriesValue(child, label, value);
    children.set(specialityKey, child);
    selectedChildrenByField.set(fieldCode, children);
  }

  for (const [fieldCode, children] of selectedChildrenByField.entries()) {
    const speciality = specialities.find(
      (item) => (item.canonicalFieldCode?.trim() ?? item.fieldCode?.trim() ?? "unknown") === fieldCode
    );
    const current = fieldTotals.get(fieldCode) ?? {
      name: formatFieldName(speciality?.canonicalFieldCode ?? speciality?.fieldCode, speciality?.canonicalFieldName ?? speciality?.fieldName),
      value: 0,
      tone: "default" as const,
      series: [],
      children: []
    };
    current.children = [...children.values()].sort((first, second) => first.name.localeCompare(second.name, "uk", { numeric: true }));
    fieldTotals.set(fieldCode, current);
  }

  const normalizeSeries = (series: Array<{ label: string; value: number }> | undefined) => {
    const valuesByYear = new Map((series ?? []).map((item) => [item.label, item.value]));
    return years.map((year) => ({
      label: String(year),
      value: valuesByYear.get(String(year)) ?? 0
    }));
  };

  const getValue = (series: Array<{ label: string; value: number }> | undefined) => {
    const valuesByYear = new Map((series ?? []).map((item) => [item.label, item.value]));
    return valuesByYear.get(String(years[0])) ?? 0;
  };

  for (const [fieldCode, total] of fieldTotals.entries()) {
    if (selectedFieldCodeSet.has(fieldCode) || (total.children?.length ?? 0) > 0) {
      total.tone = "warning";
    }
    total.value = getValue(total.series);
    total.series = normalizeSeries(total.series);
    total.children = total.children?.map((child) => ({
      ...child,
      value: getValue(child.series),
      series: normalizeSeries(child.series)
    }));
  }

  return [...fieldTotals.entries()].sort(([firstCode], [secondCode]) => firstCode.localeCompare(secondCode, "uk", { numeric: true })).map(([, total]) => total);
}

async function totalsByFieldWithSelectedSpecialities(
  baseWhere: Prisma.StudentSnapshotWhereInput,
  selectedSpecialityWhere: Prisma.StudentSnapshotWhereInput | null,
  selectedFieldCodes: string[],
  snapshotDates: Date[]
): Promise<RegionDateTotal[]> {
  const where =
    snapshotDates.length > 1
      ? {
          ...baseWhere,
          snapshotDate: { in: snapshotDates }
        }
      : {
          ...baseWhere,
          snapshotDate: snapshotDates[0] ?? baseWhere.snapshotDate
        };
  const grouped = await prisma.studentSnapshot.groupBy({
    by: ["specialityId", "snapshotDate"],
    where,
    _sum: { studentsCount: true }
  });
  const selectedGrouped = selectedSpecialityWhere
    ? await prisma.studentSnapshot.groupBy({
        by: ["specialityId", "snapshotDate"],
        where:
          snapshotDates.length > 1
            ? {
                ...selectedSpecialityWhere,
                snapshotDate: { in: snapshotDates }
              }
            : {
                ...selectedSpecialityWhere,
                snapshotDate: snapshotDates[0] ?? selectedSpecialityWhere.snapshotDate
              },
        _sum: { studentsCount: true }
      })
    : [];

  const specialityIds = [...new Set([...grouped.map((item) => item.specialityId), ...selectedGrouped.map((item) => item.specialityId)])];
  const specialities = await prisma.speciality.findMany({
    where: { id: { in: specialityIds } },
    select: {
      id: true,
      code: true,
      name: true,
      canonicalCode: true,
      canonicalName: true,
      fieldCode: true,
      fieldName: true,
      canonicalFieldCode: true,
      canonicalFieldName: true
    }
  });
  const specialityById = new Map(specialities.map((item) => [item.id, item]));
  const selectedFieldCodeSet = new Set(selectedFieldCodes);
  const fieldTotals = new Map<string, RegionDateTotal>();

  for (const item of grouped) {
    const speciality = specialityById.get(item.specialityId);
    const fieldCode = speciality?.canonicalFieldCode?.trim() ?? speciality?.fieldCode?.trim() ?? "unknown";
    const value = item._sum.studentsCount ?? 0;
    const label = item.snapshotDate.toISOString();
    const current = fieldTotals.get(fieldCode) ?? {
      name: formatFieldName(speciality?.canonicalFieldCode ?? speciality?.fieldCode, speciality?.canonicalFieldName ?? speciality?.fieldName),
      value: 0,
      tone: "default" as const,
      series: [],
      children: []
    };
    current.value += value;
    const seriesItem = current.series?.find((entry) => entry.label === label);
    if (seriesItem) {
      seriesItem.value += value;
    } else {
      current.series = [...(current.series ?? []), { label, value }];
    }
    fieldTotals.set(fieldCode, current);
  }

  const selectedChildrenByField = new Map<string, Map<string, ChildDateTotal>>();
  for (const item of selectedGrouped) {
    const speciality = specialityById.get(item.specialityId);
    const fieldCode = speciality?.canonicalFieldCode?.trim() ?? speciality?.fieldCode?.trim() ?? "unknown";
    const value = item._sum.studentsCount ?? 0;
    const label = item.snapshotDate.toISOString();
    const children = selectedChildrenByField.get(fieldCode) ?? new Map<string, ChildDateTotal>();
    const specialityKey = speciality?.canonicalCode ?? speciality?.code ?? String(item.specialityId);
    const child = children.get(specialityKey) ?? {
      name: speciality ? formatCanonicalSpeciality(speciality) : "Невідома спеціальність",
      value: 0,
      tone: "selected" as const,
      series: []
    };
    child.value += value;
    const seriesItem = child.series?.find((entry) => entry.label === label);
    if (seriesItem) {
      seriesItem.value += value;
    } else {
      child.series = [...(child.series ?? []), { label, value }];
    }
    children.set(specialityKey, child);
    selectedChildrenByField.set(fieldCode, children);
  }

  for (const [fieldCode, children] of selectedChildrenByField.entries()) {
    const speciality = specialities.find(
      (item) => (item.canonicalFieldCode?.trim() ?? item.fieldCode?.trim() ?? "unknown") === fieldCode
    );
    const current = fieldTotals.get(fieldCode) ?? {
      name: formatFieldName(speciality?.canonicalFieldCode ?? speciality?.fieldCode, speciality?.canonicalFieldName ?? speciality?.fieldName),
      value: 0,
      tone: "default" as const,
      series: [],
      children: []
    };
    current.children = [...children.values()].sort((first, second) => first.name.localeCompare(second.name, "uk", { numeric: true }));
    fieldTotals.set(fieldCode, current);
  }

  for (const [fieldCode, total] of fieldTotals.entries()) {
    if (selectedFieldCodeSet.has(fieldCode) || (total.children?.length ?? 0) > 0) {
      total.tone = "warning";
    }
  }

  const normalizeSeries = (series: Array<{ label: string; value: number }> | undefined) => {
    const valuesByDate = new Map((series ?? []).map((item) => [item.label, item.value]));
    if (snapshotDates.length > 1) {
      return snapshotDates.map((date) => ({
        label: date.toISOString(),
        value: valuesByDate.get(date.toISOString()) ?? 0
      }));
    }
    return undefined;
  };

  const getValue = (series: Array<{ label: string; value: number }> | undefined) => {
    const valuesByDate = new Map((series ?? []).map((item) => [item.label, item.value]));
    if (!snapshotDates.length) return [...valuesByDate.values()].reduce((sum, value) => sum + value, 0);
    const latestValue = valuesByDate.get(snapshotDates[0].toISOString()) ?? 0;
    if (latestValue) return latestValue;
    return [...valuesByDate.values()].reduce((sum, value) => sum + value, 0);
  };

  for (const total of fieldTotals.values()) {
    total.value = getValue(total.series);
    total.series = normalizeSeries(total.series);
    total.children = total.children?.map((child) => ({
      ...child,
      value: getValue(child.series),
      series: normalizeSeries(child.series)
    }));
  }

  return [...fieldTotals.entries()].sort(([firstCode], [secondCode]) => firstCode.localeCompare(secondCode, "uk", { numeric: true })).map(([, total]) => total);
}

function toNumber(value: number | bigint | null | undefined): number {
  return Number(value ?? 0);
}

function getSelectedFilterValues<T>(multiValue?: T[], singleValue?: T): T[] {
  return multiValue?.length ? multiValue : singleValue ? [singleValue] : [];
}

function sqlIn<T extends number | string>(values: T[]) {
  return Prisma.join(values);
}

async function getStudentSummaryCounts(filters: Partial<DashboardFiltersInput>): Promise<SummaryCounts> {
  const regionIds = getSelectedFilterValues(filters.regionIds, filters.regionId);
  const institutionIds = getSelectedFilterValues(filters.institutionIds, filters.institutionId);
  const institutionTypeCodes = getSelectedFilterValues(filters.institutionTypeCodes, filters.institutionTypeCode);
  const fieldCodes = getSelectedFilterValues(filters.fieldCodes, filters.fieldCode);
  const specialityCodes = getSelectedFilterValues(filters.specialityCodes, filters.specialityCode);
  const educationLevelNames = getSelectedFilterValues(filters.educationLevelNames, filters.educationLevelName);
  const educationLevelNameVariants = [...new Set(educationLevelNames.flatMap((name) => getEducationLevelNameVariants(name)))];
  const entryBaseIds = getSelectedFilterValues(filters.entryBaseIds, filters.entryBaseId);
  const studyFormIds = getSelectedFilterValues(filters.studyFormIds, filters.studyFormId);
  const conditions: Prisma.Sql[] = [];

  if (filters.snapshotDate) conditions.push(Prisma.sql`s."snapshotDate" = ${new Date(filters.snapshotDate)}`);
  if (regionIds.length) conditions.push(Prisma.sql`s."regionId" IN (${sqlIn(regionIds)})`);
  if (institutionIds.length) conditions.push(Prisma.sql`s."institutionId" IN (${sqlIn(institutionIds)})`);
  if (institutionTypeCodes.length) conditions.push(Prisma.sql`i."institutionTypeCode" IN (${sqlIn(institutionTypeCodes)})`);
  if (!filters.includeBlockedInstitutions) conditions.push(Prisma.sql`i."blockedAt" IS NULL`);
  if (fieldCodes.length) conditions.push(Prisma.sql`sp."canonicalFieldCode" IN (${sqlIn(fieldCodes)})`);
  if (specialityCodes.length) conditions.push(Prisma.sql`sp."canonicalCode" IN (${sqlIn(specialityCodes)})`);
  if (filters.specialityId) conditions.push(Prisma.sql`s."specialityId" = ${filters.specialityId}`);
  if (educationLevelNameVariants.length) conditions.push(Prisma.sql`el."name" IN (${sqlIn(educationLevelNameVariants)})`);
  if (!educationLevelNameVariants.length && filters.educationLevelId) conditions.push(Prisma.sql`s."educationLevelId" = ${filters.educationLevelId}`);
  if (entryBaseIds.length) conditions.push(Prisma.sql`s."entryBaseId" IN (${sqlIn(entryBaseIds)})`);
  if (studyFormIds.length) {
    conditions.push(Prisma.sql`s."studyFormId" IN (${sqlIn(studyFormIds)})`);
  } else {
    conditions.push(Prisma.sql`sf."code" <> 'total'`);
  }

  const whereSql = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
  const rows = await prisma.$queryRaw<
    Array<{
      total_students: number | bigint | null;
      institutions_count: number | bigint | null;
      specialities_count: number | bigint | null;
      regions_count: number | bigint | null;
    }>
  >(Prisma.sql`
    SELECT
      COALESCE(SUM(s."studentsCount"), 0) AS total_students,
      COUNT(DISTINCT s."institutionId") AS institutions_count,
      COUNT(DISTINCT COALESCE(sp."canonicalCode", sp."code", sp."id"::text)) AS specialities_count,
      COUNT(DISTINCT s."regionId") AS regions_count
    FROM "StudentSnapshot" s
    JOIN "Institution" i ON i."id" = s."institutionId"
    JOIN "Speciality" sp ON sp."id" = s."specialityId"
    JOIN "EducationLevel" el ON el."id" = s."educationLevelId"
    JOIN "StudyForm" sf ON sf."id" = s."studyFormId"
    ${whereSql}
  `);

  const row = rows[0];
  return {
    totalStudents: toNumber(row?.total_students),
    institutionsCount: toNumber(row?.institutions_count),
    specialitiesCount: toNumber(row?.specialities_count),
    regionsCount: toNumber(row?.regions_count)
  };
}

async function getYearlySummaryCounts(filters: Partial<DashboardFiltersInput>): Promise<SummaryCounts> {
  const years = getSelectedFilterValues(filters.years, filters.year);
  const regionIds = getSelectedFilterValues(filters.regionIds, filters.regionId);
  const institutionIds = getSelectedFilterValues(filters.institutionIds, filters.institutionId);
  const institutionTypeCodes = getSelectedFilterValues(filters.institutionTypeCodes, filters.institutionTypeCode);
  const fieldCodes = getSelectedFilterValues(filters.fieldCodes, filters.fieldCode);
  const specialityCodes = getSelectedFilterValues(filters.specialityCodes, filters.specialityCode);
  const educationLevelNames = getSelectedFilterValues(filters.educationLevelNames, filters.educationLevelName);
  const educationLevelNameVariants = [...new Set(educationLevelNames.flatMap((name) => getEducationLevelNameVariants(name)))];
  const entryBaseIds = getSelectedFilterValues(filters.entryBaseIds, filters.entryBaseId);
  const conditions: Prisma.Sql[] = [Prisma.sql`y."type" = ${filters.datasetType === "graduates" ? "graduates" : "entrants"}`];

  if (years.length) conditions.push(Prisma.sql`y."year" IN (${sqlIn(years)})`);
  if (regionIds.length) conditions.push(Prisma.sql`y."regionId" IN (${sqlIn(regionIds)})`);
  if (institutionIds.length) conditions.push(Prisma.sql`y."institutionId" IN (${sqlIn(institutionIds)})`);
  if (institutionTypeCodes.length) conditions.push(Prisma.sql`i."institutionTypeCode" IN (${sqlIn(institutionTypeCodes)})`);
  if (!filters.includeBlockedInstitutions) conditions.push(Prisma.sql`i."blockedAt" IS NULL`);
  if (fieldCodes.length) conditions.push(Prisma.sql`sp."canonicalFieldCode" IN (${sqlIn(fieldCodes)})`);
  if (specialityCodes.length) conditions.push(Prisma.sql`sp."canonicalCode" IN (${sqlIn(specialityCodes)})`);
  if (filters.specialityId) conditions.push(Prisma.sql`y."specialityId" = ${filters.specialityId}`);
  if (educationLevelNameVariants.length) conditions.push(Prisma.sql`el."name" IN (${sqlIn(educationLevelNameVariants)})`);
  if (!educationLevelNameVariants.length && filters.educationLevelId) conditions.push(Prisma.sql`y."educationLevelId" = ${filters.educationLevelId}`);
  if (entryBaseIds.length) conditions.push(Prisma.sql`y."entryBaseId" IN (${sqlIn(entryBaseIds)})`);

  const rows = await prisma.$queryRaw<
    Array<{
      total_students: number | bigint | null;
      institutions_count: number | bigint | null;
      specialities_count: number | bigint | null;
      regions_count: number | bigint | null;
    }>
  >(Prisma.sql`
    SELECT
      COALESCE(SUM(y."personsCount"), 0) AS total_students,
      COUNT(DISTINCT y."institutionId") AS institutions_count,
      COUNT(DISTINCT COALESCE(sp."canonicalCode", sp."code", sp."id"::text)) AS specialities_count,
      COUNT(DISTINCT y."regionId") AS regions_count
    FROM "YearlyOutcome" y
    JOIN "Institution" i ON i."id" = y."institutionId"
    JOIN "Speciality" sp ON sp."id" = y."specialityId"
    JOIN "EducationLevel" el ON el."id" = y."educationLevelId"
    WHERE ${Prisma.join(conditions, " AND ")}
  `);

  const row = rows[0];
  return {
    totalStudents: toNumber(row?.total_students),
    institutionsCount: toNumber(row?.institutions_count),
    specialitiesCount: toNumber(row?.specialities_count),
    regionsCount: toNumber(row?.regions_count)
  };
}

function getSameDatePreviousYear(value: string): Date {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear() - 1, date.getUTCMonth(), date.getUTCDate()));
}

function buildDynamicSeries<T extends string | number>(
  grouped: Array<{ key: T; snapshotDate: Date; value: number }>,
  names: Map<T, string>,
  dates: Date[],
  limit: number,
  prefix: string
): DynamicSeries[] {
  const valuesByKey = new Map<T, Map<string, number>>();

  for (const item of grouped) {
    const dateKey = item.snapshotDate.toISOString();
    const valuesByDate = valuesByKey.get(item.key) ?? new Map<string, number>();
    valuesByDate.set(dateKey, (valuesByDate.get(dateKey) ?? 0) + item.value);
    valuesByKey.set(item.key, valuesByDate);
  }

  return [...valuesByKey.entries()]
    .map(([key, valuesByDate]) => {
      const points = dates.map((date) => ({
        date: date.toISOString(),
        value: valuesByDate.get(date.toISOString()) ?? 0
      }));
      return {
        id: `${prefix}-${String(key)}`,
        name: names.get(key) ?? "Невідомо",
        points,
        total: points.reduce((sum, point) => sum + point.value, 0)
      };
    })
    .sort((first, second) => second.total - first.total)
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
      points: item.points
    }));
}

function buildYearlyDynamicSeries<T extends string | number>(
  grouped: Array<{ key: T; year: number; value: number }>,
  names: Map<T, string>,
  years: number[],
  limit: number,
  prefix: string
): DynamicSeries[] {
  const valuesByKey = new Map<T, Map<string, number>>();

  for (const item of grouped) {
    const yearKey = String(item.year);
    const valuesByYear = valuesByKey.get(item.key) ?? new Map<string, number>();
    valuesByYear.set(yearKey, (valuesByYear.get(yearKey) ?? 0) + item.value);
    valuesByKey.set(item.key, valuesByYear);
  }

  return [...valuesByKey.entries()]
    .map(([key, valuesByYear]) => {
      const points = years.map((year) => ({
        date: String(year),
        value: valuesByYear.get(String(year)) ?? 0
      }));
      return {
        id: `${prefix}-${String(key)}`,
        name: names.get(key) ?? "Невідомо",
        points,
        total: points.reduce((sum, point) => sum + point.value, 0)
      };
    })
    .sort((first, second) => second.total - first.total)
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
      points: item.points
    }));
}

async function getYearlyOutcomeDynamicsBreakdowns(
  where: Prisma.YearlyOutcomeWhereInput,
  years: number[],
  breakdowns: DynamicsBreakdownKey[] = ["institutions", "regions", "fields", "specialities", "educationLevels"]
) {
  const requested = new Set(breakdowns);
  const dynamicsWhere = { ...where, year: { in: years } };
  const needsSpecialities = requested.has("fields") || requested.has("specialities");
  const [institutionGrouped, regionGrouped, specialityGrouped, educationLevelGrouped] = await Promise.all([
    requested.has("institutions")
      ? prisma.yearlyOutcome.groupBy({
          by: ["institutionId", "year"],
          where: dynamicsWhere,
          _sum: { personsCount: true }
        })
      : Promise.resolve([]),
    requested.has("regions")
      ? prisma.yearlyOutcome.groupBy({
          by: ["regionId", "year"],
          where: dynamicsWhere,
          _sum: { personsCount: true }
        })
      : Promise.resolve([]),
    needsSpecialities
      ? prisma.yearlyOutcome.groupBy({
          by: ["specialityId", "year"],
          where: dynamicsWhere,
          _sum: { personsCount: true }
        })
      : Promise.resolve([]),
    requested.has("educationLevels")
      ? prisma.yearlyOutcome.groupBy({
          by: ["educationLevelId", "year"],
          where: dynamicsWhere,
          _sum: { personsCount: true }
        })
      : Promise.resolve([])
  ]);

  const [institutions, regions, specialities, educationLevels] = await Promise.all([
    institutionGrouped.length
      ? prisma.institution.findMany({
          where: { id: { in: [...new Set(institutionGrouped.map((item) => item.institutionId))] } },
          select: { id: true, name: true }
        })
      : Promise.resolve([]),
    regionGrouped.length
      ? prisma.region.findMany({
          where: { id: { in: [...new Set(regionGrouped.map((item) => item.regionId))] } },
          select: { id: true, name: true }
        })
      : Promise.resolve([]),
    specialityGrouped.length
      ? prisma.speciality.findMany({
          where: { id: { in: [...new Set(specialityGrouped.map((item) => item.specialityId))] } },
          select: {
            id: true,
            code: true,
            name: true,
            canonicalCode: true,
            canonicalName: true,
            canonicalFieldCode: true,
            canonicalFieldName: true
          }
        })
      : Promise.resolve([]),
    educationLevelGrouped.length
      ? prisma.educationLevel.findMany({
          where: { id: { in: [...new Set(educationLevelGrouped.map((item) => item.educationLevelId))] } },
          select: { id: true, name: true }
        })
      : Promise.resolve([])
  ]);

  const institutionNames = new Map(institutions.map((item) => [item.id, item.name]));
  const regionNames = new Map(regions.map((item) => [item.id, item.name]));
  const educationLevelNames = new Map(educationLevels.map((item) => [item.id, getCanonicalEducationLevelName(item.name)]));
  const specialityById = new Map(specialities.map((item) => [item.id, item]));
  const fieldNames = new Map<string, string>();
  const specialityNames = new Map<string, string>();
  const fieldRows: Array<{ key: string; year: number; value: number }> = [];
  const specialityRows: Array<{ key: string; year: number; value: number }> = [];

  for (const item of specialityGrouped) {
    const speciality = specialityById.get(item.specialityId);
    const fieldCode = speciality?.canonicalFieldCode ?? "unknown";
    const specialityCode = speciality?.canonicalCode ?? speciality?.code ?? String(item.specialityId);

    fieldNames.set(fieldCode, formatFieldName(speciality?.canonicalFieldCode, speciality?.canonicalFieldName));
    specialityNames.set(specialityCode, speciality ? formatCanonicalSpeciality(speciality) : "Невідома спеціальність");
    fieldRows.push({ key: fieldCode, year: item.year, value: item._sum.personsCount ?? 0 });
    specialityRows.push({ key: specialityCode, year: item.year, value: item._sum.personsCount ?? 0 });
  }

  const result: Partial<Record<DynamicsBreakdownKey, DynamicSeries[]>> = {};
  if (requested.has("institutions")) {
    result.institutions = buildYearlyDynamicSeries(
      institutionGrouped.map((item) => ({ key: item.institutionId, year: item.year, value: item._sum.personsCount ?? 0 })),
      institutionNames,
      years,
      8,
      "institution"
    );
  }
  if (requested.has("regions")) {
    result.regions = buildYearlyDynamicSeries(
      regionGrouped.map((item) => ({ key: item.regionId, year: item.year, value: item._sum.personsCount ?? 0 })),
      regionNames,
      years,
      12,
      "region"
    );
  }
  if (requested.has("fields")) result.fields = buildYearlyDynamicSeries(fieldRows, fieldNames, years, 12, "field");
  if (requested.has("specialities")) result.specialities = buildYearlyDynamicSeries(specialityRows, specialityNames, years, 8, "speciality");
  if (requested.has("educationLevels")) {
    result.educationLevels = buildYearlyDynamicSeries(
      educationLevelGrouped.map((item) => {
        const name = educationLevelNames.get(item.educationLevelId) ?? "РќРµРІС–РґРѕРјРѕ";
        return { key: name, year: item.year, value: item._sum.personsCount ?? 0 };
      }),
      new Map([...new Set(educationLevelNames.values())].map((name) => [name, name])),
      years,
      8,
      "education-level"
    );
  }
  return result;
}

async function getStudentDynamicsBreakdowns(
  where: Prisma.StudentSnapshotWhereInput,
  dates: Date[],
  breakdowns: DynamicsBreakdownKey[] = ["institutions", "regions", "fields", "specialities", "educationLevels", "studyForms"]
) {
  const requested = new Set(breakdowns);
  const dynamicsWhere = { ...where, snapshotDate: { in: dates } };
  const studyFormDynamicsWhere: Prisma.StudentSnapshotWhereInput = {
    ...dynamicsWhere,
    studyForm: { code: { not: "total" } }
  };
  const needsSpecialities = requested.has("fields") || requested.has("specialities");
  const [institutionGrouped, regionGrouped, specialityGrouped, educationLevelGrouped, studyFormGrouped] = await Promise.all([
    requested.has("institutions")
      ? prisma.studentSnapshot.groupBy({
          by: ["institutionId", "snapshotDate"],
          where: dynamicsWhere,
          _sum: { studentsCount: true }
        })
      : Promise.resolve([]),
    requested.has("regions")
      ? prisma.studentSnapshot.groupBy({
          by: ["regionId", "snapshotDate"],
          where: dynamicsWhere,
          _sum: { studentsCount: true }
        })
      : Promise.resolve([]),
    needsSpecialities
      ? prisma.studentSnapshot.groupBy({
          by: ["specialityId", "snapshotDate"],
          where: dynamicsWhere,
          _sum: { studentsCount: true }
        })
      : Promise.resolve([]),
    requested.has("educationLevels")
      ? prisma.studentSnapshot.groupBy({
          by: ["educationLevelId", "snapshotDate"],
          where: dynamicsWhere,
          _sum: { studentsCount: true }
        })
      : Promise.resolve([]),
    requested.has("studyForms")
      ? prisma.studentSnapshot.groupBy({
          by: ["studyFormId", "snapshotDate"],
          where: studyFormDynamicsWhere,
          _sum: { studentsCount: true }
        })
      : Promise.resolve([])
  ]);

  const [institutions, regions, specialities, educationLevels, studyForms] = await Promise.all([
    institutionGrouped.length
      ? prisma.institution.findMany({
          where: { id: { in: [...new Set(institutionGrouped.map((item) => item.institutionId))] } },
          select: { id: true, name: true }
        })
      : Promise.resolve([]),
    regionGrouped.length
      ? prisma.region.findMany({
          where: { id: { in: [...new Set(regionGrouped.map((item) => item.regionId))] } },
          select: { id: true, name: true }
        })
      : Promise.resolve([]),
    specialityGrouped.length
      ? prisma.speciality.findMany({
          where: { id: { in: [...new Set(specialityGrouped.map((item) => item.specialityId))] } },
          select: {
            id: true,
            code: true,
            name: true,
            canonicalCode: true,
            canonicalName: true,
            canonicalFieldCode: true,
            canonicalFieldName: true
          }
        })
      : Promise.resolve([]),
    educationLevelGrouped.length
      ? prisma.educationLevel.findMany({
          where: { id: { in: [...new Set(educationLevelGrouped.map((item) => item.educationLevelId))] } },
          select: { id: true, name: true }
        })
      : Promise.resolve([]),
    studyFormGrouped.length
      ? prisma.studyForm.findMany({
          where: { id: { in: [...new Set(studyFormGrouped.map((item) => item.studyFormId).filter((id): id is number => id !== null))] } },
          select: { id: true, name: true }
        })
      : Promise.resolve([])
  ]);

  const institutionNames = new Map(institutions.map((item) => [item.id, item.name]));
  const regionNames = new Map(regions.map((item) => [item.id, item.name]));
  const educationLevelNames = new Map(educationLevels.map((item) => [item.id, getCanonicalEducationLevelName(item.name)]));
  const studyFormNames = new Map(studyForms.map((item) => [item.id, item.name]));
  const specialityById = new Map(specialities.map((item) => [item.id, item]));
  const fieldNames = new Map<string, string>();
  const specialityNames = new Map<string, string>();
  const fieldRows: Array<{ key: string; snapshotDate: Date; value: number }> = [];
  const specialityRows: Array<{ key: string; snapshotDate: Date; value: number }> = [];

  for (const item of specialityGrouped) {
    const speciality = specialityById.get(item.specialityId);
    const fieldCode = speciality?.canonicalFieldCode ?? "unknown";
    const specialityCode = speciality?.canonicalCode ?? speciality?.code ?? String(item.specialityId);

    fieldNames.set(fieldCode, formatFieldName(speciality?.canonicalFieldCode, speciality?.canonicalFieldName));
    specialityNames.set(specialityCode, speciality ? formatCanonicalSpeciality(speciality) : "Невідома спеціальність");
    fieldRows.push({ key: fieldCode, snapshotDate: item.snapshotDate, value: item._sum.studentsCount ?? 0 });
    specialityRows.push({ key: specialityCode, snapshotDate: item.snapshotDate, value: item._sum.studentsCount ?? 0 });
  }

  const result: Partial<Record<DynamicsBreakdownKey, DynamicSeries[]>> = {};
  if (requested.has("institutions")) {
    result.institutions = buildDynamicSeries(
      institutionGrouped.map((item) => ({ key: item.institutionId, snapshotDate: item.snapshotDate, value: item._sum.studentsCount ?? 0 })),
      institutionNames,
      dates,
      8,
      "institution"
    );
  }
  if (requested.has("regions")) {
    result.regions = buildDynamicSeries(
      regionGrouped.map((item) => ({ key: item.regionId, snapshotDate: item.snapshotDate, value: item._sum.studentsCount ?? 0 })),
      regionNames,
      dates,
      12,
      "region"
    );
  }
  if (requested.has("fields")) result.fields = buildDynamicSeries(fieldRows, fieldNames, dates, 12, "field");
  if (requested.has("specialities")) result.specialities = buildDynamicSeries(specialityRows, specialityNames, dates, 8, "speciality");
  if (requested.has("educationLevels")) {
    result.educationLevels = buildDynamicSeries(
      educationLevelGrouped.map((item) => {
        const name = educationLevelNames.get(item.educationLevelId) ?? "РќРµРІС–РґРѕРјРѕ";
        return { key: name, snapshotDate: item.snapshotDate, value: item._sum.studentsCount ?? 0 };
      }),
      new Map([...new Set(educationLevelNames.values())].map((name) => [name, name])),
      dates,
      8,
      "education-level"
    );
  }
  if (requested.has("studyForms")) {
    result.studyForms = buildDynamicSeries(
      studyFormGrouped
        .flatMap((item) =>
          item.studyFormId === null
            ? []
            : [{ key: item.studyFormId, snapshotDate: item.snapshotDate, value: item._sum.studentsCount ?? 0 }]
        ),
      studyFormNames,
      dates,
      8,
      "study-form"
    );
  }
  return result;
}

export async function getDashboardSummary(filters: Partial<DashboardFiltersInput>) {
  if (filters.datasetType === "entrants" || filters.datasetType === "graduates") {
    const where = buildYearlyOutcomeWhere(filters);
    const counts = await getYearlySummaryCounts(filters);

    let previousDelta: number | null = null;
    const selectedYears = filters.years?.length ? filters.years : filters.year ? [filters.year] : [];
    if (selectedYears.length === 1) {
      const selectedYear = selectedYears[0];
      const previousWhere = { ...where, year: selectedYear - 1 };
      const previousRowsCount = await prisma.yearlyOutcome.count({ where: previousWhere });
      if (previousRowsCount > 0) {
        const currentTotal = await prisma.yearlyOutcome.aggregate({ where, _sum: { personsCount: true } });
        const previousTotal = await prisma.yearlyOutcome.aggregate({ where: previousWhere, _sum: { personsCount: true } });
        previousDelta = (currentTotal._sum.personsCount ?? 0) - (previousTotal._sum.personsCount ?? 0);
      }
    }

    return {
      ...counts,
      previousDelta
    };
  }

  const where = buildSnapshotWhere(filters);
  const counts = await getStudentSummaryCounts(filters);

  let previousDelta: number | null = null;
  if (filters.snapshotDate) {
    const previousSnapshotDate = getSameDatePreviousYear(filters.snapshotDate);
    const completeSnapshotDates = await getCompleteSnapshotDates();
    const hasCompletePreviousSnapshot = completeSnapshotDates.some((date) => date.getTime() === previousSnapshotDate.getTime());

    if (hasCompletePreviousSnapshot) {
      const previousWhere = { ...where, snapshotDate: previousSnapshotDate };
      const currentWhere = { ...where };
      const currentTotal = await prisma.studentSnapshot.aggregate({ where: currentWhere, _sum: { studentsCount: true } });
      const previousTotal = await prisma.studentSnapshot.aggregate({ where: previousWhere, _sum: { studentsCount: true } });
      previousDelta = (currentTotal._sum.studentsCount ?? 0) - (previousTotal._sum.studentsCount ?? 0);
    }
  }

  return {
    ...counts,
    previousDelta
  };
}

export async function getDashboardCharts(filters: Partial<DashboardFiltersInput>) {
  if (filters.datasetType === "entrants" || filters.datasetType === "graduates") {
    const institutionChartWhere = buildYearlyOutcomeWhere({
      ...filters,
      institutionId: undefined,
      institutionIds: undefined
    });
    const institutionTotalWhere = buildYearlyOutcomeWhere({
      ...filters,
      regionId: undefined,
      regionIds: undefined,
      institutionId: undefined,
      institutionIds: undefined
    });
    const regionChartWhere = buildYearlyOutcomeWhere({
      ...filters,
      regionId: undefined,
      regionIds: undefined,
      institutionId: undefined,
      institutionIds: undefined
    });
    const regionSelectedInstitutionWhere =
      filters.institutionIds?.length || filters.institutionId
        ? buildYearlyOutcomeWhere({
            ...filters,
            regionId: undefined,
            regionIds: undefined
          })
        : null;
    const fieldChartWhere = buildYearlyOutcomeWhere({
      ...filters,
      fieldCode: undefined,
      fieldCodes: undefined,
      specialityId: undefined,
      specialityCode: undefined,
      specialityCodes: undefined
    });
    const fieldSelectedSpecialityWhere =
      filters.specialityId || filters.specialityCode || filters.specialityCodes?.length
        ? buildYearlyOutcomeWhere({
            ...filters,
            fieldCode: undefined,
            fieldCodes: undefined
          })
        : null;
    const selectedFieldCodes = filters.fieldCodes?.length ? filters.fieldCodes : filters.fieldCode ? [filters.fieldCode] : [];
    const selectedYears = getSelectedYears(filters);
    const selectedRegionIds = filters.regionIds?.length ? filters.regionIds : filters.regionId ? [filters.regionId] : [];

    const [topInstitutions, topInstitutionsTotal, regions, fields] = await Promise.all([
      yearlyTotalsByRelationAcrossYears("institutionId", institutionChartWhere, selectedYears, 250),
      yearlyGrandTotalAcrossYears(institutionTotalWhere, selectedYears),
      yearlyTotalsByRegionAcrossYears(regionChartWhere, regionSelectedInstitutionWhere, selectedYears, selectedRegionIds),
      yearlyTotalsByFieldWithSelectedSpecialities(fieldChartWhere, fieldSelectedSpecialityWhere, selectedFieldCodes, selectedYears)
    ]);

    return {
      topInstitutions,
      topInstitutionsTotal,
      regions,
      fields,
      specialities: [],
      dynamics: [],
      dynamicsBreakdowns: {}
    };
  }

  const institutionChartWhere = buildSnapshotWhere({
    ...filters,
    institutionId: undefined,
    institutionIds: undefined,
    snapshotDate: undefined
  });
  const institutionTotalWhere = buildSnapshotWhere({
    ...filters,
    regionId: undefined,
    regionIds: undefined,
    institutionId: undefined,
    institutionIds: undefined,
    snapshotDate: undefined
  });
  const regionChartWhere = buildSnapshotWhere({
    ...filters,
    regionId: undefined,
    regionIds: undefined,
    institutionId: undefined,
    institutionIds: undefined,
    snapshotDate: undefined
  });
  const regionSelectedInstitutionWhere =
    filters.institutionIds?.length || filters.institutionId
      ? buildSnapshotWhere({
          ...filters,
          regionId: undefined,
          regionIds: undefined,
          snapshotDate: undefined
        })
      : null;
  const fieldChartWhere = buildSnapshotWhere({
    ...filters,
    fieldCode: undefined,
    fieldCodes: undefined,
    specialityId: undefined,
    specialityCode: undefined,
    specialityCodes: undefined
  });
  const fieldSelectedSpecialityWhere =
    filters.specialityId || filters.specialityCode || filters.specialityCodes?.length
      ? buildSnapshotWhere({
          ...filters,
          fieldCode: undefined,
          fieldCodes: undefined
        })
      : null;

  const institutionSnapshotDates = filters.snapshotDates?.length
    ? filters.snapshotDates
    : filters.snapshotDate
      ? [filters.snapshotDate]
      : [];
  const selectedSnapshotDates = getSelectedSnapshotDates(filters);
  const selectedRegionIds = filters.regionIds?.length ? filters.regionIds : filters.regionId ? [filters.regionId] : [];
  const selectedFieldCodes = filters.fieldCodes?.length ? filters.fieldCodes : filters.fieldCode ? [filters.fieldCode] : [];
  const [topInstitutions, topInstitutionsTotal, regions, fields] = await Promise.all([
    totalsByInstitutionAcrossSnapshotDates(institutionChartWhere, institutionSnapshotDates, 250),
    grandTotalAcrossSnapshotDates(institutionTotalWhere, institutionSnapshotDates),
    totalsByRegionAcrossSnapshotDates(regionChartWhere, regionSelectedInstitutionWhere, selectedSnapshotDates, selectedRegionIds),
    totalsByFieldWithSelectedSpecialities(fieldChartWhere, fieldSelectedSpecialityWhere, selectedFieldCodes, selectedSnapshotDates)
  ]);

  return {
    topInstitutions,
    topInstitutionsTotal,
    regions,
    fields,
    specialities: [],
    dynamics: [],
    dynamicsBreakdowns: {}
  };
}

export async function getDashboardDynamics(filters: Partial<DashboardFiltersInput>) {
  if (filters.datasetType === "entrants" || filters.datasetType === "graduates") {
    const where = buildYearlyOutcomeWhere(filters);
    const dynamics = await prisma.yearlyOutcome.groupBy({
      by: ["year"],
      where: { ...where, year: undefined },
      _sum: { personsCount: true },
      orderBy: { year: "asc" }
    });

    return dynamics.map((item) => ({
      name: String(item.year),
      value: item._sum.personsCount ?? 0
    }));
  }

  const where = buildSnapshotWhere(filters);
  const completeSnapshotDates = await getCompleteSnapshotDates();
  const dynamics = await prisma.studentSnapshot.groupBy({
    by: ["snapshotDate"],
    where: { ...where, snapshotDate: { in: completeSnapshotDates } },
    _sum: { studentsCount: true },
    orderBy: { snapshotDate: "asc" }
  });

  return dynamics.map((item) => ({
    name: item.snapshotDate.toISOString(),
    value: item._sum.studentsCount ?? 0
  }));
}

export async function getDashboardDynamicsBreakdowns(
  filters: Partial<DashboardFiltersInput>,
  breakdowns: DynamicsBreakdownKey[]
) {
  const uniqueBreakdowns = [...new Set(breakdowns)];
  if (!uniqueBreakdowns.length) return {};

  if (filters.datasetType === "entrants" || filters.datasetType === "graduates") {
    const supportedBreakdowns = uniqueBreakdowns.filter((breakdown) => breakdown !== "studyForms");
    if (!supportedBreakdowns.length) return {};

    const where = buildYearlyOutcomeWhere(filters);
    const dynamics = await prisma.yearlyOutcome.groupBy({
      by: ["year"],
      where: { ...where, year: undefined },
      _sum: { personsCount: true },
      orderBy: { year: "asc" }
    });

    return getYearlyOutcomeDynamicsBreakdowns(
      { ...where, year: undefined },
      dynamics.map((item) => item.year),
      supportedBreakdowns
    );
  }

  const where = buildSnapshotWhere(filters);
  const completeSnapshotDates = await getCompleteSnapshotDates();
  return getStudentDynamicsBreakdowns({ ...where, snapshotDate: undefined }, completeSnapshotDates, uniqueBreakdowns);
}

export async function getTableData(filters: DashboardFiltersInput) {
  if (filters.datasetType === "entrants" || filters.datasetType === "graduates") {
    const where = buildYearlyOutcomeWhere(filters);
    const orderBy: Prisma.YearlyOutcomeOrderByWithRelationInput =
      filters.sortBy === "studentsCount"
        ? { personsCount: filters.sortDir }
        : filters.sortBy === "snapshotDate"
          ? { year: filters.sortDir }
          : filters.sortBy === "institution"
            ? { institution: { name: filters.sortDir } }
            : filters.sortBy === "institutionType"
              ? { institution: { institutionTypeCode: filters.sortDir } }
              : filters.sortBy === "region"
                ? { region: { name: filters.sortDir } }
                : filters.sortBy === "field"
                  ? { speciality: { canonicalFieldName: filters.sortDir } }
                  : filters.sortBy === "speciality"
                    ? { speciality: { canonicalName: filters.sortDir } }
                    : filters.sortBy === "educationLevel"
                      ? { educationLevel: { name: filters.sortDir } }
                      : { entryBase: { name: filters.sortDir } };

    const [total, rows] = await Promise.all([
      prisma.yearlyOutcome.count({ where }),
      prisma.yearlyOutcome.findMany({
        where,
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: {
          institution: true,
          region: true,
          speciality: true,
          educationLevel: true,
          entryBase: true
        }
      })
    ]);

    return { total, rows };
  }

  const where = buildSnapshotWhere(filters);
  const orderBy: Prisma.StudentSnapshotOrderByWithRelationInput =
    filters.sortBy === "studentsCount"
      ? { studentsCount: filters.sortDir }
      : filters.sortBy === "snapshotDate"
        ? { snapshotDate: filters.sortDir }
        : filters.sortBy === "institution"
          ? { institution: { name: filters.sortDir } }
          : filters.sortBy === "institutionType"
            ? { institution: { institutionTypeCode: filters.sortDir } }
            : filters.sortBy === "region"
              ? { region: { name: filters.sortDir } }
              : filters.sortBy === "field"
                ? { speciality: { canonicalFieldName: filters.sortDir } }
                : filters.sortBy === "speciality"
                  ? { speciality: { canonicalName: filters.sortDir } }
        : filters.sortBy === "educationLevel"
          ? { educationLevel: { name: filters.sortDir } }
          : filters.sortBy === "studyForm"
            ? { studyForm: { name: filters.sortDir } }
            : { entryBase: { name: filters.sortDir } };

  const [total, rows] = await Promise.all([
    prisma.studentSnapshot.count({ where }),
    prisma.studentSnapshot.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        institution: true,
        region: true,
        speciality: true,
        educationLevel: true,
        entryBase: true,
        studyForm: true
      }
    })
  ]);

  return { total, rows };
}

export async function getImportHistory() {
  return prisma.importRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20
  });
}
