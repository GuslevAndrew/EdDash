"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { InstitutionsTable } from "@/components/institutions/InstitutionsTable";
import { InstitutionMultiSelect } from "@/components/ui/InstitutionMultiSelect";
import { LoadingNotice } from "@/components/ui/LoadingNotice";
import { RegionFilter } from "@/components/ui/RegionFilter";
import { SearchableMultiSelectField } from "@/components/ui/SearchableMultiSelectField";
import { specialityCatalogSource } from "@/lib/specialities/catalog";
import { formatDate, formatNumber } from "@/lib/utils/format";

const defaultPageSize = 25;
const maxPageSize = 250;
const sortKeys = ["institution", "parent", "region", "students", "foundationYear", "ownership"] as const;
const sortDirections = ["asc", "desc"] as const;

type SortKey = (typeof sortKeys)[number];
type SortDirection = (typeof sortDirections)[number];

type InstitutionFilterOption = {
  id: number;
  name: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type SpecialityOption = SelectOption & {
  fieldCode: string;
};

type InstitutionsFiltersResponse = {
  regions: InstitutionFilterOption[];
  selectedInstitutions: InstitutionFilterOption[];
  totalByLevel: {
    institutionTypeCode: string | null;
    institutionTypeName: string | null;
    count: number;
  }[];
  totalRegions: number;
  latestSnapshotDate: string | null;
  snapshotDates: string[];
  specialities: SpecialityOption[];
  educationLevels: SelectOption[];
  entryBases: SelectOption[];
  studyForms: SelectOption[];
};

function getNumberParams(searchParams: URLSearchParams, key: string): number[] {
  return searchParams
    .getAll(key)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function getStringParams(searchParams: URLSearchParams, key: string): string[] {
  return searchParams.getAll(key).filter((value) => value.trim());
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

function isValidDate(value: string): boolean {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

export function InstitutionsPageClient() {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const selectedInstitutionTypeCodes = getStringParams(searchParams, "level").filter((value) => value === "1" || value === "9");
  const filteredInstitutionTypeCodes = selectedInstitutionTypeCodes.length ? selectedInstitutionTypeCodes : ["1", "9"];
  const regionIds = getNumberParams(searchParams, "region");
  const selectedInstitutionIds = getNumberParams(searchParams, "institution");
  const requestedDateValue = searchParams.get("date") ?? "";
  const selectedFieldCodes = getStringParams(searchParams, "field");
  const selectedSpecialityCodes = getStringParams(searchParams, "speciality");
  const selectedEducationLevelNames = getStringParams(searchParams, "educationLevel");
  const selectedEntryBaseIds = getNumberParams(searchParams, "entryBase");
  const selectedStudyFormIds = getNumberParams(searchParams, "studyForm");
  const showBlocked = searchParams.get("showBlocked") === "1";
  const requestedSort = searchParams.get("sort") ?? "";
  const sortKey: SortKey = sortKeys.includes(requestedSort as SortKey) ? (requestedSort as SortKey) : "institution";
  const requestedDirection = searchParams.get("direction") ?? "";
  const sortDirection: SortDirection = sortDirections.includes(requestedDirection as SortDirection)
    ? (requestedDirection as SortDirection)
    : "asc";
  const requestedPageSize = Number(searchParams.get("pageSize") ?? "");
  const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
    ? Math.min(Math.floor(requestedPageSize), maxPageSize)
    : defaultPageSize;

  const [filters, setFilters] = useState<InstitutionsFiltersResponse | null>(null);
  const [isFiltersLoading, setIsFiltersLoading] = useState(true);
  const [filtersError, setFiltersError] = useState("");
  const filtersQuery = useMemo(() => {
    const params = new URLSearchParams();
    selectedInstitutionIds.forEach((id) => params.append("institution", String(id)));
    if (showBlocked) params.set("showBlocked", "1");
    return params.toString();
  }, [selectedInstitutionIds, showBlocked]);

  useEffect(() => {
    const controller = new AbortController();
    setIsFiltersLoading(true);
    setFiltersError("");

    fetch(`/api/institutions/filters${filtersQuery ? `?${filtersQuery}` : ""}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Institution filters request failed");
        return response.json() as Promise<InstitutionsFiltersResponse>;
      })
      .then((data) => setFilters(data))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFiltersError("Не вдалося завантажити фільтри закладів освіти. Спробуйте оновити сторінку.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsFiltersLoading(false);
      });

    return () => controller.abort();
  }, [filtersQuery]);

  const selectedSnapshotDateValue = useMemo(() => {
    if (isValidDate(requestedDateValue)) return new Date(requestedDateValue).toISOString();
    return filters?.latestSnapshotDate ?? "";
  }, [filters?.latestSnapshotDate, requestedDateValue]);

  const visibleSpecialityOptions = useMemo(() => {
    const options = filters?.specialities ?? [];
    return options.filter((item) => !selectedFieldCodes.length || selectedFieldCodes.includes(item.fieldCode));
  }, [filters?.specialities, selectedFieldCodes]);

  const currentParams = useMemo(
    () => ({
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
    }),
    [
      pageSize,
      regionIds,
      selectedEducationLevelNames,
      selectedEntryBaseIds,
      selectedFieldCodes,
      selectedInstitutionIds,
      selectedInstitutionTypeCodes,
      selectedSnapshotDateValue,
      selectedSpecialityCodes,
      selectedStudyFormIds,
      showBlocked,
      sortDirection,
      sortKey
    ]
  );
  const tableQuery = filters ? makeQueryString(currentParams) : queryString;

  return (
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
        {filtersError ? <p className="mb-4 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{filtersError}</p> : null}
        {filters ? (
          <form key={queryString} className="grid gap-5" action="/institutions">
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
                regions={filters.regions
                  .map((region) => ({ id: region.id, name: region.name }))
                  .sort((first, second) => compareRegionName(first.name, second.name))}
                selectedRegionIds={regionIds}
              />

              <div className="md:col-span-2">
                <InstitutionMultiSelect
                  institutions={filters.selectedInstitutions}
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
                  {filters.snapshotDates.map((snapshotDate) => (
                    <option key={snapshotDate} value={snapshotDate}>
                      {formatDate(snapshotDate)}
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
                options={filters.educationLevels}
                selectedValues={selectedEducationLevelNames}
                placeholder="Оберіть освітній ступінь"
                selectedLabel="Обрано освітніх ступенів"
                disableSearch
              />
              <SearchableMultiSelectField
                label="Основа вступу"
                name="entryBase"
                options={filters.entryBases}
                selectedValues={selectedEntryBaseIds.map(String)}
                placeholder="Оберіть основу вступу"
                selectedLabel="Обрано основ вступу"
                disableSearch
              />
              <SearchableMultiSelectField
                label="Форма навчання"
                name="studyForm"
                options={filters.studyForms}
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
              <span className="italic">Примітка:</span> для узгодженого відображення даних історичні записи з рівнем
              «спеціаліст» віднесено до категорії «магістр», а записи з рівнями «молодший бакалавр» і «молодший
              спеціаліст» — до категорії «фаховий молодший бакалавр».
            </p>
          </form>
        ) : (
          <FilterSkeleton />
        )}
      </section>

      {isFiltersLoading ? (
        <div className="mb-6">
          <LoadingNotice />
        </div>
      ) : null}

      {filters ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Усього закладів" value={formatNumber(filters.totalByLevel.reduce((sum, item) => sum + item.count, 0))} />
          <SummaryCard
            title="Вища освіта"
            value={formatNumber(filters.totalByLevel.find((item) => item.institutionTypeCode === "1")?.count ?? 0)}
          />
          <SummaryCard
            title="Фахова передвища освіта"
            value={formatNumber(filters.totalByLevel.find((item) => item.institutionTypeCode === "9")?.count ?? 0)}
          />
          <SummaryCard title="Регіонів" value={formatNumber(filters.totalRegions)} />
        </section>
      ) : (
        <SummarySkeleton />
      )}

      <InstitutionsTable
        key={tableQuery}
        initialQuery={tableQuery}
        initialSort={sortKey}
        initialDirection={sortDirection}
        initialPageSize={pageSize}
      />
    </div>
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

function FilterSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-4 w-32 rounded bg-slate-100" />
            <div className="h-10 rounded-md border border-line bg-slate-50" />
          </div>
        ))}
        <div className="space-y-2 md:col-span-2">
          <div className="h-4 w-32 rounded bg-slate-100" />
          <div className="h-10 rounded-md border border-line bg-slate-50" />
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-4 w-28 rounded bg-slate-100" />
            <div className="h-10 rounded-md border border-line bg-slate-50" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="h-4 w-24 rounded bg-slate-100" />
          <div className="mt-3 h-7 w-20 rounded bg-slate-100" />
        </div>
      ))}
    </section>
  );
}
