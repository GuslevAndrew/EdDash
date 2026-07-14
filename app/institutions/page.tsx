import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/layout/AppShell";
import { InstitutionsTable } from "@/components/institutions/InstitutionsTable";
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

function getParam(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getParams(params: Record<string, string | string[] | undefined>, key: string): string[] {
  const value = params[key];
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.filter((item) => item.trim());
}

function makeQueryString(params: Record<string, string | string[]>): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
    } else {
      next.set(key, value);
    }
  }
  return next.toString();
}

function compareRegionName(first: string, second: string): number {
  const priority = (name: string) => {
    if (name === "м. Київ") return 0;
    if (name === "Без регіону") return 1;
    return 2;
  };
  const priorityDelta = priority(first) - priority(second);
  if (priorityDelta !== 0) return priorityDelta;
  return first.localeCompare(second, "uk", { sensitivity: "base", numeric: true });
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

  const statsWhere: Prisma.InstitutionWhereInput = {
    institutionTypeCode: { in: ["1", "9"] },
    blockedAt: showBlocked ? undefined : null
  };

  const [
    regions,
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
    prisma.region.findMany({ orderBy: { name: "asc" } }),
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

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-lg border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            Інформація для вступників та дослідників.
          </p>
          <h1 className="mt-3 text-3xl font-bold text-ink">Заклади освіти</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            Довідкова таблиця закладів вищої та фахової передвищої освіти на основі відкритих даних ЄДЕБО.
            Тут можна швидко знайти потрібний заклад, переглянути основну інформацію про нього та перейти до
            детальнішого аналізу.
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
                disableSearch
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
                disableSearch
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
                disableSearch
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
            <p className="rounded-md border border-line bg-slate-50 px-3 py-2 text-xs leading-5 text-muted">
              <span className="italic">Примітка:</span> для узгодженого відображення даних історичні записи з рівнем «спеціаліст» віднесено до категорії
              «магістр», а записи з рівнями «молодший бакалавр» і «молодший спеціаліст» — до категорії «фаховий молодший
              бакалавр».
            </p>
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

        <InstitutionsTable
          initialQuery={makeQueryString(currentParams)}
          initialSort={sortKey}
          initialDirection={sortDirection}
          initialPageSize={pageSize}
        />
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
