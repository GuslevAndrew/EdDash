"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils/format";

type Option = {
  value: string;
  label: string;
};

export type FilterOptions = {
  dates: string[];
  datesWithStudyForms: string[];
  years: number[];
  institutionTypes: { code: string; name: string }[];
  regions: { id: number; name: string }[];
  institutions: { id: number; name: string; institutionTypeCode: string; regionId: number }[];
  fields: { code: string; name: string }[];
  specialities: { code: string; name: string; fieldCode: string; fieldName: string }[];
  educationLevels: { name: string }[];
  entryBases: { id: number; name: string }[];
  studyForms: { id: number; name: string }[];
};

export type DashboardDatasetType = "entrants" | "graduates" | "students";

export type DashboardFilterState = {
  datasetType: DashboardDatasetType;
  snapshotDate: string;
  snapshotDates: string[];
  year: string;
  years: string[];
  institutionTypeCodes: string[];
  regionIds: string[];
  institutionIds: string[];
  fieldCodes: string[];
  specialityCodes: string[];
  educationLevelNames: string[];
  entryBaseIds: string[];
  studyFormIds: string[];
  includeBlockedInstitutions: boolean;
};

export const emptyFilters: DashboardFilterState = {
  datasetType: "students",
  snapshotDate: "",
  snapshotDates: [],
  year: "",
  years: [],
  institutionTypeCodes: [],
  regionIds: [],
  institutionIds: [],
  fieldCodes: [],
  specialityCodes: [],
  educationLevelNames: [],
  entryBaseIds: [],
  studyFormIds: [],
  includeBlockedInstitutions: false
};

function matchesQuery(label: string, query: string): boolean {
  const normalizedLabel = label.toLocaleLowerCase("uk-UA");
  const words = query
    .toLocaleLowerCase("uk-UA")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  return words.every((word) => normalizedLabel.includes(word));
}

export function DashboardFilters({
  options,
  draft,
  onDraftChange,
  onApply,
  onReset
}: {
  options: FilterOptions | null;
  draft: DashboardFilterState;
  onDraftChange: (next: DashboardFilterState) => void;
  onApply: () => void;
  onReset: (currentDraft: DashboardFilterState) => void;
}) {
  const filtersRef = useRef<HTMLElement | null>(null);
  const dateOptions = useMemo<Option[]>(
    () => options?.dates.map((date) => ({ value: date, label: formatDate(date) })) ?? [],
    [options?.dates]
  );
  const yearOptions = useMemo<Option[]>(
    () => options?.years.map((year) => ({ value: String(year), label: String(year) })) ?? [],
    [options?.years]
  );
  const institutionTypeOptions = useMemo<Option[]>(
    () =>
      options?.institutionTypes
        .filter((item) => item.code === "1" || item.code === "9")
        .map((item) => ({
          value: item.code,
          label: item.code === "1" ? "Вища освіта" : "Фахова передвища освіта"
        })) ?? [],
    [options?.institutionTypes]
  );
  const institutionOptions = useMemo<Option[]>(
    () =>
      options?.institutions
        .filter((item) => !draft.institutionTypeCodes.length || draft.institutionTypeCodes.includes(item.institutionTypeCode))
        .filter((item) => !draft.regionIds.length || draft.regionIds.includes(String(item.regionId)))
        .map((item) => ({ value: String(item.id), label: item.name })) ?? [],
    [draft.institutionTypeCodes, draft.regionIds, options?.institutions]
  );
  const fieldOptions = useMemo<Option[]>(
    () => options?.fields.map((item) => ({ value: item.code, label: `${item.code} ${item.name}` })) ?? [],
    [options?.fields]
  );
  const specialityOptions = useMemo<Option[]>(
    () =>
      options?.specialities
        .filter((item) => !draft.fieldCodes.length || draft.fieldCodes.includes(item.fieldCode))
        .map((item) => ({ value: item.code, label: `${item.code} ${item.name}` })) ?? [],
    [draft.fieldCodes, options?.specialities]
  );
  const educationLevelOptions = useMemo<Option[]>(
    () => options?.educationLevels.map((item) => ({ value: item.name, label: item.name })) ?? [],
    [options?.educationLevels]
  );
  const entryBaseOptions = useMemo<Option[]>(
    () => options?.entryBases.map((item) => ({ value: String(item.id), label: item.name })) ?? [],
    [options?.entryBases]
  );
  const isStudentsDataset = draft.datasetType === "students";
  const selectedSnapshotDates = draft.snapshotDates.length ? draft.snapshotDates : draft.snapshotDate ? [draft.snapshotDate] : [];
  const datesWithStudyForms = new Set(options?.datesWithStudyForms ?? []);
  const canUseStudyForms =
    isStudentsDataset && selectedSnapshotDates.length > 0 && selectedSnapshotDates.every((date) => datesWithStudyForms.has(date));

  function changeFields(fieldCodes: string[]) {
    const allowedSpecialityCodes = new Set(
      options?.specialities
        .filter((item) => !fieldCodes.length || fieldCodes.includes(item.fieldCode))
        .map((item) => item.code) ?? []
    );
    const specialityCodes = draft.specialityCodes.filter((code) => allowedSpecialityCodes.has(code));
    onDraftChange({ ...draft, fieldCodes, specialityCodes });
  }

  function changeInstitutionTypes(institutionTypeCodes: string[]) {
    const allowedInstitutionIds = new Set(
      options?.institutions
        .filter((item) => !institutionTypeCodes.length || institutionTypeCodes.includes(item.institutionTypeCode))
        .filter((item) => !draft.regionIds.length || draft.regionIds.includes(String(item.regionId)))
        .map((item) => String(item.id)) ?? []
    );
    const institutionIds = draft.institutionIds.filter((id) => allowedInstitutionIds.has(id));
    onDraftChange({ ...draft, institutionTypeCodes, institutionIds });
  }

  function changeRegions(regionIds: string[]) {
    const allowedInstitutionIds = new Set(
      options?.institutions
        .filter((item) => !draft.institutionTypeCodes.length || draft.institutionTypeCodes.includes(item.institutionTypeCode))
        .filter((item) => !regionIds.length || regionIds.includes(String(item.regionId)))
        .map((item) => String(item.id)) ?? []
    );
    const institutionIds = draft.institutionIds.filter((id) => allowedInstitutionIds.has(id));
    onDraftChange({ ...draft, regionIds, institutionIds });
  }

  function changeSnapshotDates(snapshotDates: string[]) {
    const dateOrder = new Map((options?.dates ?? []).map((date, index) => [date, index]));
    const sortedDates = [...snapshotDates].sort((first, second) => (dateOrder.get(first) ?? 9999) - (dateOrder.get(second) ?? 9999));
    const nextCanUseStudyForms =
      sortedDates.length > 0 && sortedDates.every((date) => (options?.datesWithStudyForms ?? []).includes(date));
    onDraftChange({
      ...draft,
      snapshotDates: sortedDates,
      snapshotDate: sortedDates[0] ?? "",
      studyFormIds: nextCanUseStudyForms ? draft.studyFormIds : []
    });
  }

  function changeYears(years: string[]) {
    const yearOrder = new Map((options?.years ?? []).map((year, index) => [String(year), index]));
    const sortedYears = [...years].sort((first, second) => (yearOrder.get(first) ?? 9999) - (yearOrder.get(second) ?? 9999));
    onDraftChange({
      ...draft,
      years: sortedYears,
      year: sortedYears[0] ?? ""
    });
  }

  function changeInstitutions(institutionIds: string[]) {
    const selectedAllVisible = institutionOptions.length > 0 && institutionIds.length === institutionOptions.length;
    onDraftChange({ ...draft, institutionIds: selectedAllVisible ? [] : institutionIds });
  }

  function closeOpenFilters() {
    filtersRef.current?.querySelectorAll("details[open]").forEach((details) => {
      details.removeAttribute("open");
    });
  }

  return (
    <section ref={filtersRef} className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="grid gap-5 md:grid-cols-2">
        <SearchableMultiSelect
          label="Рівень освіти"
          allLabel="Вища освіта, Фахова передвища освіта"
          placeholder="Оберіть потрібний рівень освіти"
          selectedLabel="Обрано рівнів освіти"
          options={institutionTypeOptions}
          selectedValues={draft.institutionTypeCodes}
          onChange={changeInstitutionTypes}
          onReset={() => changeInstitutionTypes([])}
          hideAllOption
          hideResetButton
          disableSearch
        />
        <SearchableMultiSelect
          label="Регіон"
          allLabel="Усі регіони"
          placeholder="Оберіть регіон"
          selectedLabel="Обрано регіонів"
          options={options?.regions.map((item) => ({ value: String(item.id), label: item.name })) ?? []}
          selectedValues={draft.regionIds}
          onChange={changeRegions}
          onReset={() => changeRegions([])}
        />
        <div className="md:col-span-2">
          <SearchableMultiSelect
            label="Заклад освіти"
            allLabel="Усі заклади"
            placeholder="Оберіть заклад освіти"
            selectedLabel="Обрано закладів"
            options={institutionOptions}
            selectedValues={draft.institutionIds}
            onChange={changeInstitutions}
            onReset={() => onDraftChange({ ...draft, institutionIds: [] })}
            hideAllOption
          />
        </div>
        {isStudentsDataset ? (
          <SearchableMultiSelect
            label="Дата зрізу"
            allLabel="Усі дати"
            placeholder="Оберіть дату зрізу"
            selectedLabel="Обрано дат"
            options={dateOptions}
            selectedValues={draft.snapshotDates}
            onChange={changeSnapshotDates}
            onReset={() => changeSnapshotDates(options?.dates[0] ? [options.dates[0]] : [])}
          />
        ) : (
          <SearchableMultiSelect
            label="Рік"
            allLabel="Усі роки"
            placeholder="Оберіть рік"
            selectedLabel="Обрано років"
            options={yearOptions}
            selectedValues={draft.years.length ? draft.years : draft.year ? [draft.year] : []}
            onChange={changeYears}
            onReset={() => changeYears(options?.years[0] ? [String(options.years[0])] : [])}
          />
        )}
        <SearchableMultiSelect
          label="Галузь знань"
          allLabel="Усі галузі"
          placeholder="Оберіть галузь"
          selectedLabel="Обрано галузей"
          options={fieldOptions}
          selectedValues={draft.fieldCodes}
          onChange={changeFields}
          onReset={() => changeFields([])}
        />
        <SearchableMultiSelect
          label="Спеціальність"
          allLabel="Усі спеціальності"
          placeholder="Оберіть спеціальність"
          selectedLabel="Обрано спеціальностей"
          options={specialityOptions}
          selectedValues={draft.specialityCodes}
          onChange={(specialityCodes) => onDraftChange({ ...draft, specialityCodes })}
          onReset={() => onDraftChange({ ...draft, specialityCodes: [] })}
        />
        <SearchableMultiSelect
          label="Освітній ступінь"
          allLabel="Усі освітні ступені"
          placeholder="Оберіть освітній ступінь"
          selectedLabel="Обрано освітніх ступенів"
          options={educationLevelOptions}
          selectedValues={draft.educationLevelNames}
          onChange={(educationLevelNames) => onDraftChange({ ...draft, educationLevelNames })}
          onReset={() => onDraftChange({ ...draft, educationLevelNames: [] })}
        />
        <SearchableMultiSelect
          label="Основа вступу"
          allLabel="Усі основи вступу"
          placeholder="Оберіть основу вступу"
          selectedLabel="Обрано основ вступу"
          options={entryBaseOptions}
          selectedValues={draft.entryBaseIds}
          onChange={(entryBaseIds) => onDraftChange({ ...draft, entryBaseIds })}
          onReset={() => onDraftChange({ ...draft, entryBaseIds: [] })}
        />
        {isStudentsDataset && canUseStudyForms ? (
          <SearchableMultiSelect
            label="Форма навчання"
            allLabel="Усі форми навчання"
            placeholder="Оберіть форму навчання"
            selectedLabel="Обрано форм"
            options={options?.studyForms.map((item) => ({ value: String(item.id), label: item.name })) ?? []}
            selectedValues={draft.studyFormIds}
            onChange={(studyFormIds) => onDraftChange({ ...draft, studyFormIds })}
            onReset={() => onDraftChange({ ...draft, studyFormIds: [] })}
          />
        ) : isStudentsDataset ? (
          <DisabledFilterNotice
            label="Форма навчання"
            text="Деталізація за формами навчання доступна не для всіх обраних дат."
          />
        ) : null}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex w-fit items-center gap-2 rounded-md border border-line bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.includeBlockedInstitutions}
            onChange={(event) => onDraftChange({ ...draft, includeBlockedInstitutions: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="italic">Показувати / враховувати заклади, заблоковані в ЄДЕБО</span>
        </label>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            onClick={() => {
              closeOpenFilters();
              onApply();
            }}
          >
            Застосувати
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              closeOpenFilters();
              onReset(draft);
            }}
          >
            Скинути
          </Button>
        </div>
      </div>
      <p className="mt-3 rounded-md border border-line bg-slate-50 px-3 py-2 text-xs leading-5 text-muted">
        <span className="italic">Примітка:</span> для узгодженого відображення даних історичні записи з рівнем «спеціаліст» віднесено до категорії
        «магістр», а записи з рівнями «молодший бакалавр» і «молодший спеціаліст» — до категорії «фаховий молодший
        бакалавр».
      </p>
    </section>
  );
}

function DisabledFilterNotice({ label, text }: { label: string; text: string }) {
  return (
    <div className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1 rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-muted">
        {text}
      </div>
    </div>
  );
}

function SearchableMultiSelect({
  label,
  allLabel,
  placeholder,
  selectedLabel,
  options,
  selectedValues,
  onChange,
  onReset,
  hideAllOption = false,
  hideResetButton = false,
  disableSearch = false
}: {
  label: string;
  allLabel: string;
  placeholder: string;
  selectedLabel: string;
  options: Option[];
  selectedValues: string[];
  onChange: (selectedValues: string[]) => void;
  onReset?: () => void;
  hideAllOption?: boolean;
  hideResetButton?: boolean;
  disableSearch?: boolean;
}) {
  const [query, setQuery] = useState("");
  const detailsRef = useAutoCloseDetails();
  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));
  const allSelected = options.length > 0 && selectedOptions.length === options.length;
  const labelText = allSelected
    ? allLabel
    : !selectedOptions.length
      ? placeholder
    : selectedOptions.length <= 2
      ? selectedOptions.map((option) => option.label).join(", ")
      : `${selectedLabel}: ${selectedOptions.length}`;
  const filteredOptions = query ? options.filter((option) => matchesQuery(option.label, query)) : options;

  function toggleAll() {
    onChange(allSelected ? [] : options.map((option) => option.value));
  }

  function toggleValue(value: string, checked: boolean) {
    if (checked) {
      onChange(selectedValues.includes(value) ? selectedValues : [...selectedValues, value]);
      return;
    }
    onChange(selectedValues.filter((item) => item !== value));
  }

  function resetSelection() {
    if (onReset) {
      onReset();
      return;
    }
    onChange([]);
  }

  return (
    <div className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <details ref={detailsRef} className="group relative mt-1">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none hover:bg-slate-50 focus:border-brand-500">
          <span className="truncate">{labelText}</span>
          <span className="text-xs text-muted group-open:rotate-180">▼</span>
        </summary>
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-md border border-line bg-white p-2 shadow-lg">
          {!disableSearch ? (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mb-2 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="Пошук у списку"
            />
          ) : null}
          {!hideResetButton ? (
            <button
              type="button"
              onClick={resetSelection}
              disabled={!selectedValues.length}
              className="mb-2 w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Скинути
            </button>
          ) : null}
          {!hideAllOption ? (
            <>
              <button
                type="button"
                onClick={toggleAll}
                className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-medium hover:bg-slate-50 ${
                  allSelected ? "bg-brand-50 text-brand-800" : "text-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={allSelected}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>{allLabel}</span>
              </button>
              <div className="my-1 border-t border-line" />
            </>
          ) : null}
          {filteredOptions.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedValues.includes(option.value)}
                onChange={(event) => toggleValue(option.value, event.target.checked)}
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

function useAutoCloseDetails() {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;

      if (!details?.open || !(event.target instanceof Node)) {
        return;
      }

      if (!details.contains(event.target)) {
        details.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return detailsRef;
}
