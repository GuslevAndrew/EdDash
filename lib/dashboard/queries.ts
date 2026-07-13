import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCanonicalEducationLevelName } from "@/lib/education-levels/canonical";
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
type EducationLevelBreakdown = {
  title: string;
  description?: string;
  data: NamedTotal[];
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
      studyForm: { code: "total" },
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
  const [dates, datesWithStudyForms, years, regions, institutions, specialities, educationLevels, entryBases, studyForms] = await Promise.all([
    getCompleteSnapshotDates(),
    prisma.studentSnapshot
      .groupBy({
        by: ["snapshotDate"],
        where: { studyForm: { code: { not: "total" } } },
        _count: { _all: true },
        orderBy: { snapshotDate: "desc" }
      })
      .then((items) => items.filter((item) => item._count._all > 0).map((item) => item.snapshotDate)),
    prisma.yearlyOutcome.findMany({
      distinct: ["year"],
      select: { year: true },
      orderBy: { year: "desc" }
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

  return {
    dates: dates.map((date) => date.toISOString()),
    datesWithStudyForms: datesWithStudyForms.map((date) => date.toISOString()),
    years: years.map((item) => item.year),
    institutionTypes: [
      { code: "1", name: "Заклади вищої освіти" },
      { code: "9", name: "Заклади фахової передвищої освіти" }
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

async function yearlyTotalsByEducationLevel(where: Prisma.YearlyOutcomeWhereInput, take: number): Promise<NamedTotal[]> {
  const grouped = await prisma.yearlyOutcome.groupBy({
    by: ["educationLevelId"],
    where,
    _sum: { personsCount: true }
  });
  const educationLevelIds = grouped.map((item) => item.educationLevelId);
  const educationLevels = await prisma.educationLevel.findMany({
    where: { id: { in: educationLevelIds } },
    select: { id: true, name: true }
  });
  const educationLevelById = new Map(educationLevels.map((item) => [item.id, item]));
  const totals = new Map<string, NamedTotal>();

  for (const item of grouped) {
    const educationLevel = educationLevelById.get(item.educationLevelId);
    const name = getCanonicalEducationLevelName(educationLevel?.name ?? "Невідомо");
    const current = totals.get(name) ?? { name, value: 0 };
    current.value += item._sum.personsCount ?? 0;
    totals.set(name, current);
  }

  return [...totals.values()].sort((first, second) => second.value - first.value).slice(0, take);
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

async function countYearlyCanonicalSpecialities(where: Prisma.YearlyOutcomeWhereInput): Promise<number> {
  const rows = await prisma.yearlyOutcome.findMany({
    where,
    distinct: ["specialityId"],
    select: {
      specialityId: true,
      speciality: { select: { code: true, canonicalCode: true } }
    }
  });

  return new Set(rows.map((row) => row.speciality.canonicalCode ?? row.speciality.code ?? String(row.specialityId))).size;
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
  snapshotDates: string[]
): Promise<InstitutionDateTotal[]> {
  const selectedDates = [...new Set(snapshotDates)]
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => second.getTime() - first.getTime());

  if (selectedDates.length <= 1) {
    return totalsByRelation("institutionId", {
      ...where,
      snapshotDate: selectedDates[0] ?? where.snapshotDate
    });
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

  return [...groupedByInstitution.entries()]
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

async function totalsByEducationLevel(where: Prisma.StudentSnapshotWhereInput, take: number): Promise<NamedTotal[]> {
  const grouped = await prisma.studentSnapshot.groupBy({
    by: ["educationLevelId"],
    where,
    _sum: { studentsCount: true }
  });
  const educationLevelIds = grouped.map((item) => item.educationLevelId);
  const educationLevels = await prisma.educationLevel.findMany({
    where: { id: { in: educationLevelIds } },
    select: { id: true, name: true }
  });
  const educationLevelById = new Map(educationLevels.map((item) => [item.id, item]));
  const totals = new Map<string, NamedTotal>();

  for (const item of grouped) {
    const educationLevel = educationLevelById.get(item.educationLevelId);
    const name = getCanonicalEducationLevelName(educationLevel?.name ?? "Невідомо");
    const current = totals.get(name) ?? { name, value: 0 };
    current.value += item._sum.studentsCount ?? 0;
    totals.set(name, current);
  }

  return [...totals.values()].sort((first, second) => second.value - first.value).slice(0, take);
}

async function getStudentEducationLevelBreakdowns(filters: Partial<DashboardFiltersInput>): Promise<EducationLevelBreakdown[]> {
  const baseFilters = {
    ...filters,
    educationLevelId: undefined,
    educationLevelName: undefined,
    educationLevelNames: undefined
  };
  const selectedRegionIds = filters.regionIds?.length ? filters.regionIds : filters.regionId ? [filters.regionId] : [];
  const selectedInstitutionIds = filters.institutionIds?.length ? filters.institutionIds : filters.institutionId ? [filters.institutionId] : [];
  const selectedFieldCodes = filters.fieldCodes?.length ? filters.fieldCodes : filters.fieldCode ? [filters.fieldCode] : [];
  const selectedSpecialityCodes = filters.specialityCodes?.length
    ? filters.specialityCodes
    : filters.specialityCode
      ? [filters.specialityCode]
      : [];

  const [regions, institutions, fields, specialities] = await Promise.all([
    selectedRegionIds.length
      ? totalsByEducationLevel(
          buildSnapshotWhere({
            ...baseFilters,
            institutionId: undefined,
            institutionIds: undefined
          }),
          10
        )
      : Promise.resolve([]),
    selectedInstitutionIds.length ? totalsByEducationLevel(buildSnapshotWhere(baseFilters), 10) : Promise.resolve([]),
    selectedFieldCodes.length
      ? totalsByEducationLevel(
          buildSnapshotWhere({
            ...baseFilters,
            specialityId: undefined,
            specialityCode: undefined,
            specialityCodes: undefined
          }),
          10
        )
      : Promise.resolve([]),
    selectedSpecialityCodes.length ? totalsByEducationLevel(buildSnapshotWhere(baseFilters), 10) : Promise.resolve([])
  ]);

  return [
    {
      title: "За обраним регіоном",
      description: selectedRegionIds.length ? "Розподіл у межах обраного регіону або регіонів." : "Оберіть регіон у фільтрах.",
      data: regions
    },
    {
      title: "За обраним закладом освіти",
      description: selectedInstitutionIds.length ? "Розподіл у межах обраного закладу або закладів." : "Оберіть заклад освіти у фільтрах.",
      data: institutions
    },
    {
      title: "За обраною галуззю",
      description: selectedFieldCodes.length ? "Розподіл у межах обраної галузі або галузей." : "Оберіть галузь знань у фільтрах.",
      data: fields
    },
    {
      title: "За обраною спеціальністю",
      description: selectedSpecialityCodes.length ? "Розподіл у межах обраної спеціальності або спеціальностей." : "Оберіть спеціальність у фільтрах.",
      data: specialities
    }
  ];
}

async function getYearlyOutcomeEducationLevelBreakdowns(filters: Partial<DashboardFiltersInput>): Promise<EducationLevelBreakdown[]> {
  const selectedYear = getSelectedYears(filters)[0];
  const baseFilters = {
    ...filters,
    year: selectedYear,
    years: [],
    educationLevelId: undefined,
    educationLevelName: undefined,
    educationLevelNames: undefined
  };
  const selectedRegionIds = filters.regionIds?.length ? filters.regionIds : filters.regionId ? [filters.regionId] : [];
  const selectedInstitutionIds = filters.institutionIds?.length ? filters.institutionIds : filters.institutionId ? [filters.institutionId] : [];
  const selectedFieldCodes = filters.fieldCodes?.length ? filters.fieldCodes : filters.fieldCode ? [filters.fieldCode] : [];
  const selectedSpecialityCodes = filters.specialityCodes?.length
    ? filters.specialityCodes
    : filters.specialityCode
      ? [filters.specialityCode]
      : [];

  const [regions, institutions, fields, specialities] = await Promise.all([
    selectedRegionIds.length
      ? yearlyTotalsByEducationLevel(
          buildYearlyOutcomeWhere({
            ...baseFilters,
            institutionId: undefined,
            institutionIds: undefined
          }),
          10
        )
      : Promise.resolve([]),
    selectedInstitutionIds.length ? yearlyTotalsByEducationLevel(buildYearlyOutcomeWhere(baseFilters), 10) : Promise.resolve([]),
    selectedFieldCodes.length
      ? yearlyTotalsByEducationLevel(
          buildYearlyOutcomeWhere({
            ...baseFilters,
            specialityId: undefined,
            specialityCode: undefined,
            specialityCodes: undefined
          }),
          10
        )
      : Promise.resolve([]),
    selectedSpecialityCodes.length ? yearlyTotalsByEducationLevel(buildYearlyOutcomeWhere(baseFilters), 10) : Promise.resolve([])
  ]);

  return [
    {
      title: "За обраним регіоном",
      description: selectedRegionIds.length ? "Розподіл у межах обраного регіону або регіонів." : "Оберіть регіон у фільтрах.",
      data: regions
    },
    {
      title: "За обраним закладом освіти",
      description: selectedInstitutionIds.length ? "Розподіл у межах обраного закладу або закладів." : "Оберіть заклад освіти у фільтрах.",
      data: institutions
    },
    {
      title: "За обраною галуззю",
      description: selectedFieldCodes.length ? "Розподіл у межах обраної галузі або галузей." : "Оберіть галузь знань у фільтрах.",
      data: fields
    },
    {
      title: "За обраною спеціальністю",
      description: selectedSpecialityCodes.length ? "Розподіл у межах обраної спеціальності або спеціальностей." : "Оберіть спеціальність у фільтрах.",
      data: specialities
    }
  ];
}

async function countCanonicalSpecialities(where: Prisma.StudentSnapshotWhereInput): Promise<number> {
  const rows = await prisma.studentSnapshot.findMany({
    where,
    distinct: ["specialityId"],
    select: {
      specialityId: true,
      speciality: { select: { code: true, canonicalCode: true } }
    }
  });

  return new Set(rows.map((row) => row.speciality.canonicalCode ?? row.speciality.code ?? String(row.specialityId))).size;
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

async function getYearlyOutcomeDynamicsBreakdowns(where: Prisma.YearlyOutcomeWhereInput, years: number[]) {
  const dynamicsWhere = { ...where, year: { in: years } };
  const [institutionGrouped, regionGrouped, specialityGrouped, educationLevelGrouped] = await Promise.all([
    prisma.yearlyOutcome.groupBy({
      by: ["institutionId", "year"],
      where: dynamicsWhere,
      _sum: { personsCount: true }
    }),
    prisma.yearlyOutcome.groupBy({
      by: ["regionId", "year"],
      where: dynamicsWhere,
      _sum: { personsCount: true }
    }),
    prisma.yearlyOutcome.groupBy({
      by: ["specialityId", "year"],
      where: dynamicsWhere,
      _sum: { personsCount: true }
    }),
    prisma.yearlyOutcome.groupBy({
      by: ["educationLevelId", "year"],
      where: dynamicsWhere,
      _sum: { personsCount: true }
    })
  ]);

  const [institutions, regions, specialities, educationLevels] = await Promise.all([
    prisma.institution.findMany({
      where: { id: { in: [...new Set(institutionGrouped.map((item) => item.institutionId))] } },
      select: { id: true, name: true }
    }),
    prisma.region.findMany({
      where: { id: { in: [...new Set(regionGrouped.map((item) => item.regionId))] } },
      select: { id: true, name: true }
    }),
    prisma.speciality.findMany({
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
    }),
    prisma.educationLevel.findMany({
      where: { id: { in: [...new Set(educationLevelGrouped.map((item) => item.educationLevelId))] } },
      select: { id: true, name: true }
    })
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

  return {
    institutions: buildYearlyDynamicSeries(
      institutionGrouped.map((item) => ({ key: item.institutionId, year: item.year, value: item._sum.personsCount ?? 0 })),
      institutionNames,
      years,
      8,
      "institution"
    ),
    regions: buildYearlyDynamicSeries(
      regionGrouped.map((item) => ({ key: item.regionId, year: item.year, value: item._sum.personsCount ?? 0 })),
      regionNames,
      years,
      12,
      "region"
    ),
    fields: buildYearlyDynamicSeries(fieldRows, fieldNames, years, 12, "field"),
    specialities: buildYearlyDynamicSeries(specialityRows, specialityNames, years, 8, "speciality"),
    educationLevels: buildYearlyDynamicSeries(
      educationLevelGrouped.map((item) => ({ key: item.educationLevelId, year: item.year, value: item._sum.personsCount ?? 0 })),
      educationLevelNames,
      years,
      8,
      "education-level"
    )
  };
}

async function getStudentDynamicsBreakdowns(where: Prisma.StudentSnapshotWhereInput, dates: Date[]) {
  const dynamicsWhere = { ...where, snapshotDate: { in: dates } };
  const studyFormDynamicsWhere: Prisma.StudentSnapshotWhereInput = {
    ...dynamicsWhere,
    studyForm: { code: { not: "total" } }
  };
  const [institutionGrouped, regionGrouped, specialityGrouped, educationLevelGrouped, studyFormGrouped] = await Promise.all([
    prisma.studentSnapshot.groupBy({
      by: ["institutionId", "snapshotDate"],
      where: dynamicsWhere,
      _sum: { studentsCount: true }
    }),
    prisma.studentSnapshot.groupBy({
      by: ["regionId", "snapshotDate"],
      where: dynamicsWhere,
      _sum: { studentsCount: true }
    }),
    prisma.studentSnapshot.groupBy({
      by: ["specialityId", "snapshotDate"],
      where: dynamicsWhere,
      _sum: { studentsCount: true }
    }),
    prisma.studentSnapshot.groupBy({
      by: ["educationLevelId", "snapshotDate"],
      where: dynamicsWhere,
      _sum: { studentsCount: true }
    }),
    prisma.studentSnapshot.groupBy({
      by: ["studyFormId", "snapshotDate"],
      where: studyFormDynamicsWhere,
      _sum: { studentsCount: true }
    })
  ]);

  const [institutions, regions, specialities, educationLevels, studyForms] = await Promise.all([
    prisma.institution.findMany({
      where: { id: { in: [...new Set(institutionGrouped.map((item) => item.institutionId))] } },
      select: { id: true, name: true }
    }),
    prisma.region.findMany({
      where: { id: { in: [...new Set(regionGrouped.map((item) => item.regionId))] } },
      select: { id: true, name: true }
    }),
    prisma.speciality.findMany({
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
    }),
    prisma.educationLevel.findMany({
      where: { id: { in: [...new Set(educationLevelGrouped.map((item) => item.educationLevelId))] } },
      select: { id: true, name: true }
    }),
    prisma.studyForm.findMany({
      where: { id: { in: [...new Set(studyFormGrouped.map((item) => item.studyFormId).filter((id): id is number => id !== null))] } },
      select: { id: true, name: true }
    })
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

  return {
    institutions: buildDynamicSeries(
      institutionGrouped.map((item) => ({ key: item.institutionId, snapshotDate: item.snapshotDate, value: item._sum.studentsCount ?? 0 })),
      institutionNames,
      dates,
      8,
      "institution"
    ),
    regions: buildDynamicSeries(
      regionGrouped.map((item) => ({ key: item.regionId, snapshotDate: item.snapshotDate, value: item._sum.studentsCount ?? 0 })),
      regionNames,
      dates,
      12,
      "region"
    ),
    fields: buildDynamicSeries(fieldRows, fieldNames, dates, 12, "field"),
    specialities: buildDynamicSeries(specialityRows, specialityNames, dates, 8, "speciality"),
    educationLevels: buildDynamicSeries(
      educationLevelGrouped.map((item) => ({ key: item.educationLevelId, snapshotDate: item.snapshotDate, value: item._sum.studentsCount ?? 0 })),
      educationLevelNames,
      dates,
      8,
      "education-level"
    ),
    studyForms: buildDynamicSeries(
      studyFormGrouped
        .filter((item): item is typeof item & { studyFormId: number } => item.studyFormId !== null)
        .map((item) => ({ key: item.studyFormId, snapshotDate: item.snapshotDate, value: item._sum.studentsCount ?? 0 })),
      studyFormNames,
      dates,
      8,
      "study-form"
    )
  };
}

export async function getDashboardSummary(filters: Partial<DashboardFiltersInput>) {
  if (filters.datasetType === "entrants" || filters.datasetType === "graduates") {
    const where = buildYearlyOutcomeWhere(filters);
    const [persons, institutions, specialitiesCount, regions] = await Promise.all([
      prisma.yearlyOutcome.aggregate({ where, _sum: { personsCount: true } }),
      prisma.yearlyOutcome.findMany({ where, distinct: ["institutionId"], select: { institutionId: true } }),
      countYearlyCanonicalSpecialities(where),
      prisma.yearlyOutcome.findMany({ where, distinct: ["regionId"], select: { regionId: true } })
    ]);

    let previousDelta: number | null = null;
    const selectedYears = filters.years?.length ? filters.years : filters.year ? [filters.year] : [];
    if (selectedYears.length === 1) {
      const selectedYear = selectedYears[0];
      const previousWhere = { ...where, year: selectedYear - 1 };
      const previousRowsCount = await prisma.yearlyOutcome.count({ where: previousWhere });
      if (previousRowsCount > 0) {
        const [currentTotal, previousTotal] = await Promise.all([
          prisma.yearlyOutcome.aggregate({ where, _sum: { personsCount: true } }),
          prisma.yearlyOutcome.aggregate({ where: previousWhere, _sum: { personsCount: true } })
        ]);
        previousDelta = (currentTotal._sum.personsCount ?? 0) - (previousTotal._sum.personsCount ?? 0);
      }
    }

    return {
      totalStudents: persons._sum.personsCount ?? 0,
      institutionsCount: institutions.length,
      specialitiesCount,
      regionsCount: regions.length,
      previousDelta
    };
  }

  const where = buildSnapshotWhere(filters);
  const [students, institutions, specialitiesCount, regions] = await Promise.all([
    prisma.studentSnapshot.aggregate({ where, _sum: { studentsCount: true } }),
    prisma.studentSnapshot.findMany({ where, distinct: ["institutionId"], select: { institutionId: true } }),
    countCanonicalSpecialities(where),
    prisma.studentSnapshot.findMany({ where, distinct: ["regionId"], select: { regionId: true } })
  ]);

  let previousDelta: number | null = null;
  if (filters.snapshotDate) {
    const previousSnapshotDate = getSameDatePreviousYear(filters.snapshotDate);
    const completeSnapshotDates = await getCompleteSnapshotDates();
    const hasCompletePreviousSnapshot = completeSnapshotDates.some((date) => date.getTime() === previousSnapshotDate.getTime());

    if (hasCompletePreviousSnapshot) {
      const previousWhere = { ...where, snapshotDate: previousSnapshotDate };
      const currentWhere = { ...where };
      const [currentTotal, previousTotal] = await Promise.all([
        prisma.studentSnapshot.aggregate({ where: currentWhere, _sum: { studentsCount: true } }),
        prisma.studentSnapshot.aggregate({ where: previousWhere, _sum: { studentsCount: true } })
      ]);
      previousDelta = (currentTotal._sum.studentsCount ?? 0) - (previousTotal._sum.studentsCount ?? 0);
    }
  }

  return {
    totalStudents: students._sum.studentsCount ?? 0,
    institutionsCount: institutions.length,
    specialitiesCount,
    regionsCount: regions.length,
    previousDelta
  };
}

export async function getDashboardCharts(filters: Partial<DashboardFiltersInput>) {
  if (filters.datasetType === "entrants" || filters.datasetType === "graduates") {
    const where = buildYearlyOutcomeWhere(filters);
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
    const dynamics = await prisma.yearlyOutcome.groupBy({
      by: ["year"],
      where: { ...where, year: undefined },
      _sum: { personsCount: true },
      orderBy: { year: "asc" }
    });

    const dynamicsYears = dynamics.map((item) => item.year);
    const [topInstitutions, topInstitutionsTotal, regions, fields, educationLevels, educationLevelBreakdowns, dynamicsBreakdowns] = await Promise.all([
      yearlyTotalsByRelationAcrossYears("institutionId", institutionChartWhere, selectedYears),
      yearlyTotalsByRelationAcrossYears("institutionId", institutionTotalWhere, selectedYears),
      yearlyTotalsByRegionAcrossYears(regionChartWhere, regionSelectedInstitutionWhere, selectedYears, selectedRegionIds),
      yearlyTotalsByFieldWithSelectedSpecialities(fieldChartWhere, fieldSelectedSpecialityWhere, selectedFieldCodes, selectedYears),
      yearlyTotalsByEducationLevel(where, 10),
      getYearlyOutcomeEducationLevelBreakdowns(filters),
      getYearlyOutcomeDynamicsBreakdowns({ ...where, year: undefined }, dynamicsYears)
    ]);

    return {
      topInstitutions,
      topInstitutionsTotal,
      regions,
      fields,
      specialities: [],
      educationLevels,
      educationLevelBreakdowns,
      dynamics: dynamics.map((item) => ({
        name: String(item.year),
        value: item._sum.personsCount ?? 0
      })),
      dynamicsBreakdowns
    };
  }

  const where = buildSnapshotWhere(filters);
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
  const completeSnapshotDates = await getCompleteSnapshotDates();
  const dynamics = await prisma.studentSnapshot.groupBy({
    by: ["snapshotDate"],
    where: { ...where, snapshotDate: { in: completeSnapshotDates } },
    _sum: { studentsCount: true },
    orderBy: { snapshotDate: "asc" }
  });

  const institutionSnapshotDates = filters.snapshotDates?.length
    ? filters.snapshotDates
    : filters.snapshotDate
      ? [filters.snapshotDate]
      : [];
  const selectedSnapshotDates = getSelectedSnapshotDates(filters);
  const selectedRegionIds = filters.regionIds?.length ? filters.regionIds : filters.regionId ? [filters.regionId] : [];
  const selectedFieldCodes = filters.fieldCodes?.length ? filters.fieldCodes : filters.fieldCode ? [filters.fieldCode] : [];
  const [topInstitutions, topInstitutionsTotal, regions, fields, educationLevels, educationLevelBreakdowns, dynamicsBreakdowns] = await Promise.all([
    totalsByInstitutionAcrossSnapshotDates(institutionChartWhere, institutionSnapshotDates),
    totalsByInstitutionAcrossSnapshotDates(institutionTotalWhere, institutionSnapshotDates),
    totalsByRegionAcrossSnapshotDates(regionChartWhere, regionSelectedInstitutionWhere, selectedSnapshotDates, selectedRegionIds),
    totalsByFieldWithSelectedSpecialities(fieldChartWhere, fieldSelectedSpecialityWhere, selectedFieldCodes, selectedSnapshotDates),
    totalsByEducationLevel(where, 10),
    getStudentEducationLevelBreakdowns(filters),
    getStudentDynamicsBreakdowns({ ...where, snapshotDate: undefined }, completeSnapshotDates)
  ]);

  return {
    topInstitutions,
    topInstitutionsTotal,
    regions,
    fields,
    specialities: [],
    educationLevels,
    educationLevelBreakdowns,
    dynamics: dynamics.map((item) => ({
      name: item.snapshotDate.toISOString(),
      value: item._sum.studentsCount ?? 0
    })),
    dynamicsBreakdowns
  };
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
