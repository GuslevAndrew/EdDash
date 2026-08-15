"use client";

import { useEffect, useMemo, useState } from "react";
import type { EducationProgramRow } from "@/lib/education-programs/types";
import { specialityCatalogSource } from "@/lib/specialities/catalog";
import { formatNumber } from "@/lib/utils/format";
import { useAutoCloseDetails } from "@/components/ui/useAutoCloseDetails";

type Option = {
  value: string;
  label: string;
};

type FilterState = {
  regions: string[];
  institutions: string[];
  institutionTypes: string[];
  fields: string[];
  specialities: string[];
  specializations: string[];
};

type EducationProgramsResponse = {
  year: number;
  totalRows: number;
  filteredCount: number;
  rows: EducationProgramRow[];
  options: {
    regions: Option[];
    institutions: Option[];
    institutionTypes: Option[];
    fields: Option[];
    specialities: Option[];
    specializations: Option[];
  };
};

const emptyFilters: FilterState = {
  regions: [],
  institutions: [],
  institutionTypes: [],
  fields: [],
  specialities: [],
  specializations: []
};

const initialVisibleRows = 50;
const visibleStep = 50;

const institutionTypeLabels: Record<string, string> = {
  "1": "Вища освіта",
  "8": "Наукові інститути (установи)",
  "9": "Фахова передвища освіта",
  "10": "Заклади післядипломної освіти",
  unknown: "Рівень закладу не визначено"
};

function labelFromOptions(selected: string[], options: Option[], placeholder: string, manyLabel: string): string {
  if (!selected.length) return placeholder;
  const labelsByValue = new Map(options.map((option) => [option.value, option.label]));
  if (selected.length <= 2) return selected.map((value) => labelsByValue.get(value) ?? value).join(", ");
  return `${manyLabel}: ${selected.length}`;
}

function toggleValue(values: string[], value: string, checked: boolean): string[] {
  if (checked) return values.includes(value) ? values : [...values, value];
  return values.filter((item) => item !== value);
}

function getFieldName(code: string): string {
  const field = specialityCatalogSource.fields.find((item) => item.code === code);
  return field ? `${field.code} ${field.name}` : code;
}

function getInstitutionTypeName(code: string, fallback: string): string {
  return institutionTypeLabels[code] ?? fallback;
}

function makeQuery(filters: FilterState, limit: number): string {
  const params = new URLSearchParams();
  filters.regions.forEach((value) => params.append("region", value));
  filters.institutions.forEach((value) => params.append("institution", value));
  filters.institutionTypes.forEach((value) => params.append("level", value));
  filters.fields.forEach((value) => params.append("field", value));
  filters.specialities.forEach((value) => params.append("speciality", value));
  filters.specializations.forEach((value) => params.append("specialization", value));
  params.set("limit", String(limit));
  return params.toString();
}

const emptyResponse: EducationProgramsResponse = {
  year: 2025,
  totalRows: 0,
  filteredCount: 0,
  rows: [],
  options: {
    regions: [],
    institutions: [],
    institutionTypes: [],
    fields: [],
    specialities: [],
    specializations: []
  }
};

export function EducationProgramsClient() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [visibleRows, setVisibleRows] = useState(initialVisibleRows);
  const [data, setData] = useState<EducationProgramsResponse>(emptyResponse);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError("");

    fetch(`/api/education-programs?${makeQuery(filters, visibleRows)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Education programs request failed");
        return response.json() as Promise<EducationProgramsResponse>;
      })
      .then((payload) => setData(payload))
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError("Не вдалося завантажити освітні програми. Спробуйте оновити сторінку.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [filters, visibleRows]);

  const displayedRows = data.rows;
  const activeFiltersCount = Object.values(filters).reduce((sum, values) => sum + values.length, 0);

  function updateFilter(key: keyof FilterState, values: string[]) {
    setVisibleRows(initialVisibleRows);
    setFilters((current) => ({ ...current, [key]: values }));
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setVisibleRows(initialVisibleRows);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="grid gap-5 md:grid-cols-2">
          <FilterSelect
            label="Регіон"
            options={data.options.regions}
            selectedValues={filters.regions}
            placeholder="Оберіть регіон"
            selectedLabel="Обрано регіонів"
            onChange={(values) => updateFilter("regions", values)}
          />
          <FilterSelect
            label="Рівень закладу освіти"
            options={data.options.institutionTypes}
            selectedValues={filters.institutionTypes}
            placeholder="Оберіть рівень закладу освіти"
            selectedLabel="Обрано рівнів"
            onChange={(values) => updateFilter("institutionTypes", values)}
            disableSearch
          />
          <div className="md:col-span-2">
            <FilterSelect
              label="Заклад освіти"
              options={data.options.institutions}
              selectedValues={filters.institutions}
              placeholder="Оберіть заклад освіти"
              selectedLabel="Обрано закладів"
              onChange={(values) => updateFilter("institutions", values)}
            />
          </div>
          <FilterSelect
            label="Галузь знань"
            options={data.options.fields}
            selectedValues={filters.fields}
            placeholder="Оберіть галузь знань"
            selectedLabel="Обрано галузей"
            onChange={(values) => updateFilter("fields", values)}
          />
          <FilterSelect
            label="Спеціальність"
            options={data.options.specialities}
            selectedValues={filters.specialities}
            placeholder="Оберіть спеціальність"
            selectedLabel="Обрано спеціальностей"
            onChange={(values) => updateFilter("specialities", values)}
          />
          <div className="md:col-span-2">
            <FilterSelect
              label="Спеціалізація"
              options={data.options.specializations}
              selectedValues={filters.specializations}
              placeholder="Оберіть спеціалізацію"
              selectedLabel="Обрано спеціалізацій"
              onChange={(values) => updateFilter("specializations", values)}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <p className="text-sm text-muted">
            Показано за фільтрами: <span className="font-semibold text-ink">{formatNumber(data.filteredCount)}</span> з{" "}
            <span className="font-semibold text-ink">{formatNumber(data.totalRows)}</span> освітніх програм за {data.year} рік.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!activeFiltersCount}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-brand-200 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Скинути
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Освітні програми</h2>
            <p className="mt-1 text-sm text-muted">Таблиця сформована за реальними назвами освітніх програм із файлу зарахованих на навчання.</p>
          </div>
          <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-800">
            Рядків: <span className="font-semibold">{formatNumber(data.filteredCount)}</span>
          </div>
        </div>

        {error ? <p className="mt-5 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {isLoading ? <p className="mt-5 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">Завантажуємо освітні програми...</p> : null}

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="bg-slate-50 px-3 py-3 text-center font-semibold text-slate-700">№</th>
                <th className="bg-slate-50 px-3 py-3 font-semibold text-slate-700">Освітня програма</th>
                <th className="bg-slate-50 px-3 py-3 font-semibold text-slate-700">Заклад освіти</th>
                <th className="bg-slate-50 px-3 py-3 font-semibold text-slate-700">Регіон</th>
                <th className="bg-slate-50 px-3 py-3 font-semibold text-slate-700">Рівень закладу</th>
                <th className="bg-slate-50 px-3 py-3 font-semibold text-slate-700">Галузь</th>
                <th className="bg-slate-50 px-3 py-3 font-semibold text-slate-700">Спеціальність</th>
                <th className="bg-slate-50 px-3 py-3 font-semibold text-slate-700">Спеціалізація</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row, index) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-3 py-3 text-center font-medium text-slate-500">{index + 1}</td>
                  <td className="px-3 py-3 font-semibold text-ink">{row.programName}</td>
                  <td className="px-3 py-3 text-slate-700">
                    <span>{row.institutionName}</span>
                    <span className="mt-1 block text-xs text-muted">ЄДЕБО: {row.institutionCode}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{row.region}</td>
                  <td className="px-3 py-3 text-slate-700">{getInstitutionTypeName(row.institutionTypeCode, row.institutionTypeName)}</td>
                  <td className="px-3 py-3 text-slate-700">{getFieldName(row.fieldCode)}</td>
                  <td className="px-3 py-3 text-slate-700">
                    {row.specialityCode} {row.specialityName}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {row.specializationCode && row.specializationName ? `${row.specializationCode} ${row.specializationName}` : "Без спеціалізації"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && !data.filteredCount ? (
          <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-muted">
            Освітні програми за обраними фільтрами не знайдено.
          </p>
        ) : null}

        {visibleRows < data.filteredCount ? (
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setVisibleRows((current) => current + visibleStep)}
              className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-brand-200 hover:bg-brand-50"
            >
              Показати ще
            </button>
            <span className="text-sm text-muted">Залишилось: {formatNumber(data.filteredCount - visibleRows)}</span>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  options,
  selectedValues,
  placeholder,
  selectedLabel,
  onChange,
  disableSearch = false
}: {
  label: string;
  options: Option[];
  selectedValues: string[];
  placeholder: string;
  selectedLabel: string;
  onChange: (values: string[]) => void;
  disableSearch?: boolean;
}) {
  const [query, setQuery] = useState("");
  const detailsRef = useAutoCloseDetails();
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase("uk-UA").trim();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.label.toLocaleLowerCase("uk-UA").includes(normalizedQuery));
  }, [options, query]);

  return (
    <div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <details ref={detailsRef} className="group relative mt-1">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm shadow-sm outline-none transition hover:border-brand-200 hover:bg-brand-50/50 focus:border-brand-500">
          <span className="truncate">{labelFromOptions(selectedValues, options, placeholder, selectedLabel)}</span>
          <span className="text-xs text-muted transition group-open:rotate-180" aria-hidden="true">▼</span>
        </summary>
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-md border border-line bg-white p-2 shadow-dropdown">
          {!disableSearch ? (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mb-2 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Пошук у списку"
            />
          ) : null}
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={!selectedValues.length}
            className="mb-2 w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Скинути
          </button>
          {filteredOptions.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedValues.includes(option.value)}
                onChange={(event) => onChange(toggleValue(selectedValues, option.value, event.target.checked))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>{option.label}</span>
            </label>
          ))}
          {!filteredOptions.length ? <p className="px-2 py-3 text-sm text-muted">Нічого не знайдено</p> : null}
        </div>
      </details>
    </div>
  );
}
