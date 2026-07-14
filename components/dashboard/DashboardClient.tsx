"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EducationLevelPieGrid,
  ExpandableInstitutionChartCard,
  LineChartCard,
  RegionChartCard,
  type ChartDatum,
  type DynamicsBreakdownValue,
  type DynamicsSeries,
  type PieChartGroup
} from "./ChartCard";
import { DashboardFilters, emptyFilters, type DashboardFilterState, type FilterOptions } from "./DashboardFilters";
import { DeltaStatCard, StatCard } from "./StatCard";
import { formatDate } from "@/lib/utils/format";

type Summary = {
  totalStudents: number;
  institutionsCount: number;
  specialitiesCount: number;
  regionsCount: number;
  previousDelta: number | null;
};

type Charts = {
  topInstitutions: ChartDatum[];
  topInstitutionsTotal: ChartDatum[];
  regions: ChartDatum[];
  fields: ChartDatum[];
  specialities: ChartDatum[];
  educationLevels: ChartDatum[];
  educationLevelBreakdowns: PieChartGroup[];
  dynamics: ChartDatum[];
  dynamicsBreakdowns?: Partial<Record<DynamicsBreakdownValue, DynamicsSeries[]>>;
};

const defaultSummary: Summary = {
  totalStudents: 0,
  institutionsCount: 0,
  specialitiesCount: 0,
  regionsCount: 0,
  previousDelta: null
};

const defaultCharts: Charts = {
  topInstitutions: [],
  topInstitutionsTotal: [],
  regions: [],
  fields: [],
  specialities: [],
  educationLevels: [],
  educationLevelBreakdowns: [],
  dynamics: [],
  dynamicsBreakdowns: {}
};

const datasetLabels: Record<DashboardFilterState["datasetType"], string> = {
  entrants: "Зараховані на навчання",
  graduates: "Закінчили навчання",
  students: "Здобувачі освіти"
};

const datasetDescriptions: Record<DashboardFilterState["datasetType"], string> = {
  entrants:
    "У цьому блоці показано кількість осіб, зарахованих на навчання відповідно до вибраних фільтрів.",
  graduates:
    "У цьому блоці показано кількість осіб, які завершили навчання відповідно до вибраних фільтрів.",
  students:
    "У цьому блоці показано кількість здобувачів освіти відповідно до вибраних фільтрів."
};

const datasetTabs: Array<{ value: DashboardFilterState["datasetType"]; label: string }> = [
  { value: "students", label: "Здобувачі освіти" },
  { value: "entrants", label: "Зараховані на навчання" },
  { value: "graduates", label: "Закінчили навчання" }
];

const allDynamicsBreakdownOptions: Array<{ value: DynamicsBreakdownValue; label: string }> = [
  { value: "institutions", label: "По закладах освіти" },
  { value: "regions", label: "По регіонах" },
  { value: "fields", label: "По галузях" },
  { value: "specialities", label: "По спеціальностях" },
  { value: "educationLevels", label: "По освітнім рівням" },
  { value: "studyForms", label: "По формах навчання" }
];

function getInitialFilters(options: FilterOptions | null): DashboardFilterState {
  return {
    ...emptyFilters,
    snapshotDate: options?.dates[0] ?? "",
    snapshotDates: options?.dates[0] ? [options.dates[0]] : []
  };
}

export function DashboardClient({ initialOptions = null }: { initialOptions?: FilterOptions | null }) {
  const initialFilters = getInitialFilters(initialOptions);
  const [options, setOptions] = useState<FilterOptions | null>(initialOptions);
  const [draft, setDraft] = useState<DashboardFilterState>(initialFilters);
  const [filters, setFilters] = useState<DashboardFilterState>(initialFilters);
  const [summary, setSummary] = useState<Summary>(defaultSummary);
  const [charts, setCharts] = useState<Charts>(defaultCharts);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [dynamicDateValues, setDynamicDateValues] = useState<string[]>([]);
  const [dynamicBreakdowns, setDynamicBreakdowns] = useState<DynamicsBreakdownValue[]>([]);
  const isStudentsDataset = filters.datasetType === "students";
  const totalLabel =
    filters.datasetType === "entrants"
      ? "Зараховано осіб"
      : filters.datasetType === "graduates"
        ? "Закінчили навчання"
        : "Загальна кількість здобувачів";
  const institutionChartTitle =
    filters.datasetType === "entrants"
      ? "Заклади освіти за кількістю зарахованих"
      : filters.datasetType === "graduates"
        ? "Заклади освіти за кількістю випускників"
        : "Заклади освіти за контингентом";
  const regionChartTitle =
    filters.datasetType === "entrants"
      ? "Кількість зарахованих за регіонами"
      : filters.datasetType === "graduates"
        ? "Кількість випускників за регіонами"
        : "Кількість здобувачів за регіонами";
  const dynamicsChartTitle = "Контингент в динаміці";
  const latestDateFilters = useMemo<DashboardFilterState>(
    () => ({
      ...emptyFilters,
      snapshotDate: options?.dates[0] ?? "",
      snapshotDates: options?.dates[0] ? [options.dates[0]] : [],
      year: options?.years[0] ? String(options.years[0]) : "",
      years: options?.years[0] ? [String(options.years[0])] : []
    }),
    [options?.dates, options?.years]
  );
  const showSummaryCards = !isStudentsDataset || filters.snapshotDates.length <= 1;
  const selectedEducationLevelYear = useMemo(() => {
    const years = filters.years.length ? filters.years : filters.year ? [filters.year] : [];
    return [...years].sort((first, second) => Number(second) - Number(first))[0] ?? "";
  }, [filters.year, filters.years]);
  const hasEducationLevelContextFilters = [
    filters.institutionTypeCodes,
    filters.regionIds,
    filters.institutionIds,
    filters.fieldCodes,
    filters.specialityCodes,
    filters.educationLevelNames,
    filters.entryBaseIds,
    filters.studyFormIds
  ].some((items) => items.length > 0);
  const educationLevelPeriodLabel = hasEducationLevelContextFilters
    ? isStudentsDataset
      ? `станом на ${formatDate(filters.snapshotDate)}`
      : `за ${selectedEducationLevelYear} рік`
    : "";
  const educationLevelTitle = `Розподіл за освітніми ступенями${educationLevelPeriodLabel ? ` ${educationLevelPeriodLabel}` : ""}`;
  const educationLevelDescription = isStudentsDataset
    ? filters.snapshotDates.length > 1
      ? "Ця інфографіка може показувати дані тільки на одну конкретну дату. Через вибір кількох дат показано найсвіжіший обраний зріз."
      : "Ця інфографіка показує розподіл тільки на одну конкретну дату."
    : filters.years.length > 1
      ? "Ця інфографіка може показувати дані тільки за один конкретний рік. Через вибір кількох років показано найсвіжіший обраний рік."
      : "Ця інфографіка показує розподіл тільки за один конкретний рік.";

  const params = useMemo(() => {
    const search = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item) search.append(key, item);
        });
        return;
      }
      if (typeof value === "boolean") {
        if (value) search.set(key, "true");
        return;
      }
      if (value) search.set(key, value);
    });
    return search;
  }, [filters]);

  const selectedInstitutionNames = useMemo(() => {
    if (!options || !filters.institutionIds.length) return [];
    const availableInstitutions = options.institutions.filter((institution) => {
      const matchesInstitutionType =
        !filters.institutionTypeCodes.length || filters.institutionTypeCodes.includes(institution.institutionTypeCode);
      const matchesRegion = !filters.regionIds.length || filters.regionIds.includes(String(institution.regionId));
      return matchesInstitutionType && matchesRegion;
    });
    if (availableInstitutions.length > 0 && filters.institutionIds.length === availableInstitutions.length) return [];
    const selectedIds = new Set(filters.institutionIds);
    return options.institutions.filter((institution) => selectedIds.has(String(institution.id))).map((institution) => institution.name);
  }, [filters.institutionIds, filters.institutionTypeCodes, filters.regionIds, options]);
  const dynamicsBreakdownOptions = useMemo(
    () =>
      allDynamicsBreakdownOptions.filter((option) => {
        if (option.value !== "studyForms") return true;
        return isStudentsDataset;
      }),
    [isStudentsDataset]
  );
  const visibleDynamics = useMemo(() => {
    const selectedDates = new Set(dynamicDateValues);
    return charts.dynamics.filter((item) => selectedDates.has(item.name));
  }, [charts.dynamics, dynamicDateValues]);

  useEffect(() => {
    setDynamicDateValues(charts.dynamics.map((item) => item.name));
  }, [charts.dynamics]);

  useEffect(() => {
    const availableValues = new Set(dynamicsBreakdownOptions.map((option) => option.value));
    setDynamicBreakdowns((current) => current.filter((item) => availableValues.has(item)));
  }, [dynamicsBreakdownOptions]);

  useEffect(() => {
    if (initialOptions) return;

    fetch("/api/filters")
      .then((response) => response.json())
      .then((data: FilterOptions) => {
        setOptions(data);
        if (data.dates[0]) {
          const next = {
            ...emptyFilters,
            snapshotDate: data.dates[0],
            snapshotDates: [data.dates[0]]
          };
          setDraft(next);
          setFilters(next);
        }
      })
      .catch(() => setMessage("Не вдалося завантажити фільтри. Перевірте базу даних."));
  }, [initialOptions]);

  useEffect(() => {
    if (!options?.dates[0] || filters.datasetType !== "students" || filters.snapshotDates.length) return;
    const next = { ...filters, snapshotDate: options.dates[0], snapshotDates: [options.dates[0]] };
    setDraft((current) =>
      current.datasetType === "students" && !current.snapshotDates.length
        ? { ...current, snapshotDate: options.dates[0], snapshotDates: [options.dates[0]] }
        : current
    );
    setFilters(next);
  }, [filters, options?.dates]);

  useEffect(() => {
    if (!options) return;
    if (filters.datasetType === "students" && !filters.snapshotDates.length) return;

    let active = true;
    async function load() {
      setLoading(true);
      setMessage(null);
      try {
        const [summaryResponse, chartsResponse] = await Promise.all([
          fetch(`/api/dashboard/summary?${params.toString()}`),
          fetch(`/api/dashboard/charts?${params.toString()}`)
        ]);
        if (!summaryResponse.ok || !chartsResponse.ok) {
          throw new Error("Dashboard API returned an error");
        }
        const [summaryData, chartsData] = await Promise.all([
          summaryResponse.json(),
          chartsResponse.json()
        ]);
        if (!active) return;
        setSummary(summaryData);
        setCharts({ ...defaultCharts, ...chartsData });
      } catch {
        if (active) setMessage("Не вдалося оновити дашборд. Дані залишилися без змін.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [filters.datasetType, params]);

  function applyFilters() {
    setFilters(draft);
  }

  function resetFilters(currentDraft: DashboardFilterState) {
    const next =
      currentDraft.datasetType === "students"
        ? {
            ...latestDateFilters,
            datasetType: currentDraft.datasetType,
            year: "",
            years: []
          }
        : {
            ...emptyFilters,
            datasetType: currentDraft.datasetType,
            year: latestDateFilters.year,
            years: latestDateFilters.years
          };
    setDraft(next);
    setFilters(next);
  }

  function changeDatasetType(nextDatasetType: DashboardFilterState["datasetType"]) {
    const next: DashboardFilterState = {
      ...draft,
      datasetType: nextDatasetType,
      snapshotDate: nextDatasetType === "students" ? draft.snapshotDate || latestDateFilters.snapshotDate : "",
      snapshotDates:
        nextDatasetType === "students"
          ? draft.snapshotDates.length
            ? draft.snapshotDates
            : latestDateFilters.snapshotDates
          : [],
      year: nextDatasetType === "students" ? "" : draft.year || latestDateFilters.year,
      years:
        nextDatasetType === "students"
          ? []
          : draft.years.length
            ? draft.years
            : latestDateFilters.years,
      studyFormIds: nextDatasetType === "students" ? draft.studyFormIds : []
    };

    setDraft(next);
    setFilters(next);
  }

  function changeDynamicDates(dateValues: string[]) {
    setDynamicDateValues(
      dateValues.sort((first, second) => {
        const firstIndex = charts.dynamics.findIndex((item) => item.name === first);
        const secondIndex = charts.dynamics.findIndex((item) => item.name === second);
        return firstIndex - secondIndex;
      })
    );
  }

  function toggleDynamicBreakdown(value: DynamicsBreakdownValue, checked: boolean) {
    setDynamicBreakdowns((current) => {
      if (checked) return current.includes(value) ? current : [...current, value];
      return current.filter((item) => item !== value);
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ink">Дашборд: {datasetLabels[filters.datasetType]}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {datasetDescriptions[filters.datasetType]}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Стан навчання">
        {datasetTabs.map((tab) => {
          const isActive = filters.datasetType === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => changeDatasetType(tab.value)}
              className={`rounded-t-md border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                  : "border-line bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <DashboardFilters options={options} draft={draft} onDraftChange={setDraft} onApply={applyFilters} onReset={resetFilters} />

      {message ? <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{message}</div> : null}
      {loading ? <div className="mt-4 text-sm text-muted">Оновлюю дані, зачекайте декілька секунд...</div> : null}

      {showSummaryCards ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard title={totalLabel} value={summary.totalStudents} />
          <StatCard title="Закладів освіти" value={summary.institutionsCount} />
          <StatCard title="Спеціальностей" value={summary.specialitiesCount} />
          <StatCard title="Представлених регіонів" value={summary.regionsCount} />
          <DeltaStatCard
            delta={summary.previousDelta}
            snapshotDate={filters.snapshotDate}
            year={filters.years.length === 1 ? filters.years[0] : filters.year}
          />
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <ExpandableInstitutionChartCard
          title={institutionChartTitle}
          data={charts.topInstitutions}
          totalData={charts.topInstitutionsTotal}
          selectedNames={selectedInstitutionNames}
        />
        <RegionChartCard
          title={regionChartTitle}
          data={charts.regions}
          totalLabel={isStudentsDataset ? "Разом по всіх регіонах" : "Разом по обраним регіонам"}
          totalMode={isStudentsDataset ? "all" : "warning"}
          initialVisibleCount={7}
        />
        <RegionChartCard
          title="Здобувачі за галуззю та спеціальністю"
          data={charts.fields}
          totalLabel="Разом по галузям та спеціальностям"
          childGroupLabel="Спеціальності"
        />
        <LineChartCard
          title={dynamicsChartTitle}
          data={visibleDynamics}
          allData={charts.dynamics}
          dynamicsSeries={charts.dynamicsBreakdowns}
          selectedDateValues={dynamicDateValues}
          onDateSelectionChange={changeDynamicDates}
          breakdownOptions={dynamicsBreakdownOptions}
          selectedBreakdowns={dynamicBreakdowns}
          onBreakdownToggle={toggleDynamicBreakdown}
        />
        <EducationLevelPieGrid
          title={educationLevelTitle}
          description={educationLevelDescription}
          groups={charts.educationLevelBreakdowns}
        />
      </section>
    </div>
  );
}
