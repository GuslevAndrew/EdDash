import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/layout/AppShell";
import { InstitutionMultiSelect } from "@/components/ui/InstitutionMultiSelect";
import { RegionFilter } from "@/components/ui/RegionFilter";
import { SearchableMultiSelectField } from "@/components/ui/SearchableMultiSelectField";
import { prisma } from "@/lib/db";
import { getCanonicalEducationLevelName } from "@/lib/education-levels/canonical";
import { specialityCatalogSource } from "@/lib/specialities/catalog";
import { formatDate, formatNumber } from "@/lib/utils/format";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

function getParam(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getParams(params: Record<string, string | string[] | undefined>, key: string): string[] {
  const value = params[key];
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.filter((item) => item.trim());
}

function makePageHref(params: Record<string, string | string[]>, page: number): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
    } else {
      next.set(key, value);
    }
  }
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const query = next.toString();
  return query ? `/institutions?${query}` : "/institutions";
}

function makeSortHref(params: Record<string, string | string[]>, sort: SortKey, currentSort: SortKey, currentDirection: SortDirection): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
    } else {
      next.set(key, value);
    }
  }
  const direction = sort === currentSort && currentDirection === "asc" ? "desc" : "asc";
  next.set("sort", sort);
  next.set("direction", direction);
  const query = next.toString();
  return query ? `/institutions?${query}` : "/institutions";
}

function displayLocation(regionName: string, settlement: string | null): string {
  const normalizedSettlement = settlement?.trim().toLowerCase();
  if (regionName === "м. Київ" && normalizedSettlement === "київ") return regionName;
  if (settlement) return `${regionName}, ${settlement}`;
  return regionName;
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

function displayShortName(value: string | null): string {
  const normalized = value?.trim();
  if (!normalized || normalized === "." || normalized === "-") return "—";
  return normalized;
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

function compareRegionName(first: string, second: string): number {
  const priority = (name: string) => {
    if (name === "м. Київ") return 0;
    if (name === "Без регіону") return 1;
    return 2;
  };
  const priorityDelta = priority(first) - priority(second);
  if (priorityDelta !== 0) return priorityDelta;
  return compareText(first, second);
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

type MainInstitutionInfo = {
  name: string;
  website: string | null;
  blockedAt: string | null;
};

function mainInstitutionInfo(
  institution: { externalId: string | null; parentExternalId: string | null },
  parents: Map<string, MainInstitutionInfo>
): MainInstitutionInfo | null {
  if (!institution.parentExternalId || institution.parentExternalId === institution.externalId) return null;
  return (
    parents.get(institution.parentExternalId) ?? {
      name: "Головний заклад не знайдено в довіднику",
      website: null,
      blockedAt: null
    }
  );
}

export default async function InstitutionsPage({ searchParams }: PageProps) {
  const rawParams = (await searchParams) ?? {};
  const selectedInstitutionTypeCodes = getParams(rawParams, "level").filter((value) => value === "1" || value === "9");
  const filteredInstitutionTypeCodes = selectedInstitutionTypeCodes.length ? selectedInstitutionTypeCodes : ["1", "9"];
  const regionIds = getParams(rawParams, "region")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const selectedInstitutionIds = getParams(rawParams, "institution")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const requestedDateValue = getParam(rawParams, "date");
  const selectedFieldCodes = getParams(rawParams, "field");
  const selectedSpecialityCodes = getParams(rawParams, "speciality");
  const selectedEducationLevelNames = getParams(rawParams, "educationLevel");
  const selectedEntryBaseIds = getParams(rawParams, "entryBase")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const selectedStudyFormIds = getParams(rawParams, "studyForm")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const showBlocked = getParam(rawParams, "showBlocked") === "1";
  const page = Math.max(1, Number(getParam(rawParams, "page")) || 1);
  const requestedSort = getParam(rawParams, "sort");
  const sortKey: SortKey = sortKeys.includes(requestedSort as SortKey) ? (requestedSort as SortKey) : "institution";
  const requestedDirection = getParam(rawParams, "direction");
  const sortDirection: SortDirection = sortDirections.includes(requestedDirection as SortDirection)
    ? (requestedDirection as SortDirection)
    : "asc";
  const requestedPageSize = Number(getParam(rawParams, "pageSize"));
  const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
    ? Math.min(Math.floor(requestedPageSize), maxPageSize)
    : defaultPageSize;

  const where: Prisma.InstitutionWhereInput = {
    institutionTypeCode: { in: filteredInstitutionTypeCodes },
    regionId: regionIds.length ? { in: regionIds } : undefined,
    id: selectedInstitutionIds.length ? { in: selectedInstitutionIds } : undefined,
    blockedAt: showBlocked ? undefined : null
  };
  const statsWhere: Prisma.InstitutionWhereInput = {
    institutionTypeCode: { in: ["1", "9"] },
    blockedAt: showBlocked ? undefined : null
  };

  const [
    regions,
    filteredInstitutionRefs,
    selectedInstitutionOptions,
    totalByLevel,
    totalRegions,
    latestSnapshot,
    snapshotDateRows,
    specialities,
    educationLevels,
    entryBases,
    studyForms
  ] = await Promise.all([
    prisma.region.findMany({
      where: { institutions: { some: {} } },
      orderBy: { name: "asc" }
    }),
    prisma.institution.findMany({
      where,
      select: {
        id: true,
        name: true,
        externalId: true,
        parentExternalId: true,
        foundationYear: true,
        ownership: true,
        website: true,
        blockedAt: true,
        region: { select: { name: true } }
      }
    }),
    selectedInstitutionIds.length
      ? prisma.institution.findMany({
          where: { id: { in: selectedInstitutionIds } },
          select: { id: true, name: true },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([]),
    prisma.institution.groupBy({
      by: ["institutionTypeCode", "institutionTypeName"],
      where: statsWhere,
      _count: { _all: true },
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
      select: { canonicalCode: true, canonicalName: true, canonicalFieldCode: true, canonicalFieldName: true },
      orderBy: [{ canonicalFieldCode: "asc" }, { canonicalCode: "asc" }]
    }),
    prisma.educationLevel.findMany({ orderBy: { name: "asc" } }),
    prisma.entryBase.findMany({ orderBy: { name: "asc" } }),
    prisma.studyForm.findMany({ where: { code: { not: "total" } }, orderBy: { name: "asc" } })
  ]);

  const selectedSnapshotDate =
    requestedDateValue && !Number.isNaN(new Date(requestedDateValue).getTime())
      ? new Date(requestedDateValue)
      : latestSnapshot?.snapshotDate;
  const selectedSnapshotDateValue = selectedSnapshotDate?.toISOString() ?? "";
  const canonicalSpecialityOptions = specialities
    .filter(
      (item): item is {
        canonicalCode: string;
        canonicalName: string;
        canonicalFieldCode: string;
        canonicalFieldName: string;
      } => Boolean(item.canonicalCode && item.canonicalName && item.canonicalFieldCode && item.canonicalFieldName)
    )
    .map((item) => ({
      value: item.canonicalCode,
      label: `${item.canonicalCode} ${item.canonicalName}`,
      fieldCode: item.canonicalFieldCode
    }));
  const visibleSpecialityOptions = canonicalSpecialityOptions.filter(
    (item) => !selectedFieldCodes.length || selectedFieldCodes.includes(item.fieldCode)
  );
  const selectedEducationLevelIdSet = new Set(
    educationLevels
      .filter((item) => selectedEducationLevelNames.includes(getCanonicalEducationLevelName(item.name)))
      .map((item) => item.id)
  );

  const parentExternalIdsForSorting = [
    ...new Set(
      filteredInstitutionRefs
        .map((institution) => institution.parentExternalId)
        .filter((id): id is string => Boolean(id))
        .filter((id) => !filteredInstitutionRefs.some((institution) => institution.externalId === id))
    )
  ];
  const parentInstitutions = parentExternalIdsForSorting.length
    ? await prisma.institution.findMany({
        where: { externalId: { in: parentExternalIdsForSorting } },
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
  const allStudentTotals = filteredInstitutionRefs.length && latestSnapshot
    ? await prisma.studentSnapshot.groupBy({
        by: ["institutionId"],
        where: {
          snapshotDate: selectedSnapshotDate ?? latestSnapshot.snapshotDate,
          institutionId: { in: filteredInstitutionRefs.map((institution) => institution.id) },
          speciality: {
            canonicalFieldCode: selectedFieldCodes.length ? { in: selectedFieldCodes } : undefined,
            canonicalCode: selectedSpecialityCodes.length ? { in: selectedSpecialityCodes } : undefined
          },
          educationLevelId: selectedEducationLevelIdSet.size ? { in: [...selectedEducationLevelIdSet] } : undefined,
          entryBaseId: selectedEntryBaseIds.length ? { in: selectedEntryBaseIds } : undefined,
          studyFormId: selectedStudyFormIds.length ? { in: selectedStudyFormIds } : undefined,
          studyForm: selectedStudyFormIds.length ? undefined : { code: "total" }
        },
        _sum: { studentsCount: true }
      })
    : [];
  const studentsByInstitution = new Map(
    allStudentTotals.map((item) => [item.institutionId, item._sum.studentsCount ?? 0] as const)
  );
  const sortedInstitutionRefs = [...filteredInstitutionRefs].sort((first, second) =>
    compareInstitutionRefs(first, second, sortKey, sortDirection, parentNamesByExternalId, studentsByInstitution)
  );
  const total = sortedInstitutionRefs.length;
  const pageInstitutionIds = sortedInstitutionRefs
    .slice((page - 1) * pageSize, page * pageSize)
    .map((institution) => institution.id);
  const pageInstitutionOrder = new Map(pageInstitutionIds.map((id, index) => [id, index] as const));
  const institutions = pageInstitutionIds.length
    ? (
        await prisma.institution.findMany({
          where: { id: { in: pageInstitutionIds } },
          include: { region: true }
        })
      ).sort((first, second) => (pageInstitutionOrder.get(first.id) ?? 0) - (pageInstitutionOrder.get(second.id) ?? 0))
    : [];

  const parentInstitutionsByExternalId = new Map([
    ...institutions
      .filter((institution) => institution.externalId)
      .map(
        (institution) =>
          [
            institution.externalId ?? "",
            { name: institution.name, website: institution.website, blockedAt: institution.blockedAt }
          ] as const
      ),
    ...filteredInstitutionRefs
      .filter((institution) => institution.externalId)
      .map(
        (institution) =>
          [
            institution.externalId ?? "",
            { name: institution.name, website: institution.website, blockedAt: institution.blockedAt }
          ] as const
      ),
    ...parentInstitutions
      .filter((institution) => institution.externalId)
      .map(
        (institution) =>
          [
            institution.externalId ?? "",
            { name: institution.name, website: institution.website, blockedAt: institution.blockedAt }
          ] as const
      )
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showMoreSize = Math.min(pageSize + defaultPageSize, total, maxPageSize);
  const canShowMore = pageSize < total && pageSize < maxPageSize;
  const currentParams = {
    ...(selectedInstitutionTypeCodes.length ? { level: selectedInstitutionTypeCodes } : {}),
    ...(regionIds.length ? { region: regionIds.map(String) } : {}),
    ...(selectedInstitutionIds.length ? { institution: selectedInstitutionIds.map(String) } : {}),
    ...(selectedSnapshotDateValue ? { date: selectedSnapshotDateValue } : {}),
    ...(selectedFieldCodes.length ? { field: selectedFieldCodes } : {}),
    ...(selectedSpecialityCodes.length ? { speciality: selectedSpecialityCodes } : {}),
    ...(selectedEducationLevelNames.length ? { educationLevel: selectedEducationLevelNames } : {}),
    ...(selectedEntryBaseIds.length ? { entryBase: selectedEntryBaseIds.map(String) } : {}),
    ...(selectedStudyFormIds.length ? { studyForm: selectedStudyFormIds.map(String) } : {}),
    ...(showBlocked ? { showBlocked: "1" } : {}),
    ...(sortKey !== "institution" || sortDirection !== "asc" ? { sort: sortKey, direction: sortDirection } : {}),
    ...(pageSize !== defaultPageSize ? { pageSize: String(pageSize) } : {})
  };
  const showMoreParams = {
    ...currentParams,
    pageSize: String(showMoreSize)
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-lg border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Інформація для вступників та дослідників.</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">Заклади освіти</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            Довідкова таблиця закладів вищої та фахової передвищої освіти на основі відкритих даних ЄДЕБО.
            Тут можна швидко знайти потрібний заклад, переглянути основну інформацію про нього та перейти до детальнішого аналізу.
          </p>
        </section>

        <section className="mb-6 rounded-lg border border-line bg-white p-5 shadow-soft">
          <form className="grid gap-5" action="/institutions">
            {sortKey !== "institution" || sortDirection !== "asc" ? (
              <>
                <input type="hidden" name="sort" value={sortKey} />
                <input type="hidden" name="direction" value={sortDirection} />
              </>
            ) : null}
            <div className="grid gap-5 md:grid-cols-2">
              <SearchableMultiSelectField
                label="Рівень освіти"
                name="level"
                options={[
                  { value: "1", label: "Вища освіта" },
                  { value: "9", label: "Фахова передвища освіта" }
                ]}
                selectedValues={selectedInstitutionTypeCodes}
                placeholder="Оберіть потрібний рівень освіти"
                selectedLabel="Обрано рівнів освіти"
                disableSearch
                hideResetButton
              />

              <RegionFilter
                regions={regions
                  .map((region) => ({ id: region.id, name: region.name }))
                  .sort((first, second) => compareRegionName(first.name, second.name))}
                selectedRegionIds={regionIds}
              />

              <div className="md:col-span-2">
                <InstitutionMultiSelect
                  institutions={selectedInstitutionOptions}
                  selectedInstitutionIds={selectedInstitutionIds}
                  levelCodes={filteredInstitutionTypeCodes}
                  regionIds={regionIds}
                  showBlocked={showBlocked}
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Дата зрізу</span>
                <select
                  name="date"
                  defaultValue={selectedSnapshotDateValue}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  {snapshotDateRows.map((item) => (
                    <option key={item.snapshotDate.toISOString()} value={item.snapshotDate.toISOString()}>
                      {formatDate(item.snapshotDate)}
                    </option>
                  ))}
                </select>
              </label>
              <SearchableMultiSelectField
                label="Галузь знань"
                name="field"
                options={specialityCatalogSource.fields.map((field) => ({
                  value: field.code,
                  label: `${field.code} ${field.name}`
                }))}
                selectedValues={selectedFieldCodes}
                placeholder="Оберіть галузь"
                selectedLabel="Обрано галузей"
              />
              <SearchableMultiSelectField
                label="Спеціальність"
                name="speciality"
                options={visibleSpecialityOptions}
                selectedValues={selectedSpecialityCodes}
                placeholder="Оберіть спеціальність"
                selectedLabel="Обрано спеціальностей"
              />
              <SearchableMultiSelectField
                label="Освітній ступінь"
                name="educationLevel"
                options={[
                  ...new Map(
                    educationLevels.map((item) => {
                      const name = getCanonicalEducationLevelName(item.name);
                      return [name, { value: name, label: name }];
                    })
                  ).values()
                ].sort((first, second) => first.label.localeCompare(second.label, "uk"))}
                selectedValues={selectedEducationLevelNames}
                placeholder="Оберіть освітній ступінь"
                selectedLabel="Обрано освітніх ступенів"
              />
              <SearchableMultiSelectField
                label="Основа вступу"
                name="entryBase"
                options={entryBases.map((entryBase) => ({
                  value: String(entryBase.id),
                  label: entryBase.name
                }))}
                selectedValues={selectedEntryBaseIds.map(String)}
                placeholder="Оберіть основу вступу"
                selectedLabel="Обрано основ вступу"
              />
              <SearchableMultiSelectField
                label="Форма навчання"
                name="studyForm"
                options={studyForms.map((studyForm) => ({
                  value: String(studyForm.id),
                  label: studyForm.name
                }))}
                selectedValues={selectedStudyFormIds.map(String)}
                placeholder="Оберіть форму навчання"
                selectedLabel="Обрано форм навчання"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex w-fit items-center gap-2 rounded-md border border-line bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="showBlocked"
                  value="1"
                  defaultChecked={showBlocked}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="italic">Показувати / враховувати заклади, заблоковані в ЄДЕБО</span>
              </label>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  Застосувати
                </button>
                <Link className="rounded-md border border-line bg-white px-4 py-2 text-center text-sm font-semibold text-ink hover:bg-slate-50" href="/institutions">
                  Скинути
                </Link>
              </div>
            </div>
          </form>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Усього закладів" value={formatNumber(totalByLevel.reduce((sum, item) => sum + item._count._all, 0))} />
          <SummaryCard
            title="Вища освіта"
            value={formatNumber(totalByLevel.find((item) => item.institutionTypeCode === "1")?._count._all ?? 0)}
          />
          <SummaryCard
            title="Фахова передвища освіта"
            value={formatNumber(totalByLevel.find((item) => item.institutionTypeCode === "9")?._count._all ?? 0)}
          />
          <SummaryCard title="Регіонів" value={formatNumber(totalRegions)} />
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Таблиця закладів</h2>
              <p className="mt-1 text-sm text-muted">
                Знайдено: {formatNumber(total)}
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Натискайте на назву стовпчика, щоб відсортувати таблицю за відповідною ознакою. За замовчуванням
                заклади освіти розташовані в алфавітному порядку з урахуванням обраних фільтрів.
              </p>
            </div>
            <p className="text-sm text-muted">
              Сторінка {page} з {totalPages}
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[1220px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-slate-50">
                  <th className="w-10 px-2 py-3 text-center font-semibold text-slate-700">№</th>
                  <SortableHeader
                    label="Заклад освіти"
                    sort="institution"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    params={currentParams}
                  />
                  <SortableHeader
                    label="Головний заклад"
                    sort="parent"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    params={currentParams}
                  />
                  <SortableHeader
                    label="Регіон"
                    sort="region"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    params={currentParams}
                  />
                  <SortableHeader
                    label="Контингент"
                    sort="students"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    params={currentParams}
                    align="right"
                  />
                  <SortableHeader
                    label="Рік заснування"
                    sort="foundationYear"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    params={currentParams}
                  />
                  <SortableHeader
                    label="Форма власності"
                    sort="ownership"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    params={currentParams}
                  />
                  <th className="px-3 py-3 font-semibold text-slate-700">Контакти</th>
                </tr>
              </thead>
              <tbody>
                {institutions.map((institution, index) => {
                  const website = normalizeWebsite(institution.website);
                  const isBlocked = Boolean(institution.blockedAt);
                  const parentInstitution = mainInstitutionInfo(institution, parentInstitutionsByExternalId);
                  const parentWebsite = normalizeWebsite(parentInstitution?.website ?? null);
                  const parentHref = parentWebsite && !parentInstitution?.blockedAt ? parentWebsite : null;
                  const canLinkToParent = !website && Boolean(parentHref);
                  const rowNumber = (page - 1) * pageSize + index + 1;
                  return (
                    <tr key={institution.id} className={`border-b ${isBlocked ? "border-rose-100 bg-rose-50" : "border-slate-100"}`}>
                      <td className="px-2 py-3 text-center align-top text-sm font-medium text-slate-500">{formatNumber(rowNumber)}</td>
                      <td className="px-3 py-3 align-top">
                        <div className="max-w-sm">
                          {website && !isBlocked ? (
                            <Link className="font-semibold text-brand-700 hover:text-brand-800" href={website}>
                              {institution.name}
                            </Link>
                          ) : (
                            <span className={`font-semibold ${isBlocked ? "text-rose-800" : "text-ink"}`}>{institution.name}</span>
                          )}
                          {displayShortName(institution.shortName) !== "—" ? (
                            <p className="mt-1 text-xs text-slate-500">{displayShortName(institution.shortName)}</p>
                          ) : null}
                          {isBlocked ? (
                            <p className="mt-1 text-xs font-semibold text-rose-700">
                              Заблоковано в ЄДЕБО: {institution.blockedAt}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-slate-700">
                        {parentInstitution ? (
                          canLinkToParent ? (
                            <Link className="font-medium text-brand-700 hover:text-brand-800" href={parentHref as string}>
                              {parentInstitution.name}
                            </Link>
                          ) : (
                            parentInstitution.name
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-slate-700">{displayLocation(institution.region.name, institution.settlement)}</td>
                      <td className="px-3 py-3 text-right align-top font-semibold text-ink">
                        {studentsByInstitution.has(institution.id)
                          ? formatNumber(studentsByInstitution.get(institution.id) ?? 0)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 align-top text-slate-700">{institution.foundationYear || "—"}</td>
                      <td className="px-3 py-3 align-top text-slate-700">{institution.ownership || "—"}</td>
                      <td className="px-3 py-3 align-top text-slate-700">
                        <div className="max-w-xs space-y-1 text-xs leading-5">
                          {institution.address ? <p>{institution.address}</p> : null}
                          {institution.phone ? <p>{institution.phone}</p> : null}
                          {institution.email ? <a className="block text-brand-700 hover:text-brand-800" href={`mailto:${institution.email}`}>{institution.email}</a> : null}
                          {!institution.address && !institution.phone && !institution.email ? <span>—</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!institutions.length ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-muted">
                      Заклади не знайдено. Змініть фільтри або оновіть довідник закладів.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canShowMore ? (
              <>
                <Link
                  className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                  href={makePageHref(showMoreParams, 1)}
                >
                  Показати ще
                </Link>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <p className="text-sm font-medium text-muted">{title}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function SortableHeader({
  label,
  note,
  sort,
  currentSort,
  currentDirection,
  params,
  align = "left"
}: {
  label: string;
  note?: string;
  sort: SortKey;
  currentSort: SortKey;
  currentDirection: SortDirection;
  params: Record<string, string | string[]>;
  align?: "left" | "right";
}) {
  const isActive = sort === currentSort;
  const arrow = isActive ? (currentDirection === "asc" ? "↑" : "↓") : "↕";

  return (
    <th className={`px-3 py-3 font-semibold text-slate-700 ${align === "right" ? "text-right" : "text-left"}`}>
      <Link
        className={`inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-white ${
          align === "right" ? "justify-end" : "justify-start"
        } ${isActive ? "text-brand-700" : "text-slate-700"}`}
        href={makeSortHref(params, sort, currentSort, currentDirection)}
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-xs">
          {arrow}
        </span>
      </Link>
      {note ? <span className="block text-xs font-medium text-muted">{note}</span> : null}
    </th>
  );
}
