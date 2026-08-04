"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExpandableInstitutionChartCard,
  LineChartCard,
  RegionChartCard,
  type ChartDatum,
  type DynamicsBreakdownValue,
  type DynamicsSeries
} from "./ChartCard";
import { DashboardFilters, emptyFilters, type DashboardFilterState, type FilterOptions } from "./DashboardFilters";
import { DeltaStatCard, StatCard } from "./StatCard";
import { LoadingNotice } from "@/components/ui/LoadingNotice";

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
  dynamics: ChartDatum[];
  dynamicsBreakdowns?: Partial<Record<DynamicsBreakdownValue, DynamicsSeries[]>>;
};

const defaultCharts: Charts = {
  topInstitutions: [],
  topInstitutionsTotal: [],
  regions: [],
  fields: [],
  specialities: [],
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

const chartHelpTexts = {
  institutions:
    "Блок показує заклади освіти за кількістю осіб у вибраному стані навчання. За замовчуванням видно перші позиції за найбільшим значенням, кнопку «Показати ще» можна використати для розширення списку. Якщо у фільтрі обрати конкретні заклади, вони піднімуться нагору і будуть виділені окремим кольором.",
  regions:
    "Блок показує розподіл кількості осіб за регіонами. Обрані регіони не прибирають інші з графіка, а піднімаються нагору та виділяються кольором, щоб можна було порівняти їх із загальною картиною.",
  fields:
    "Блок показує дані за галузями знань і спеціальностями. Галузі є основним рівнем, а спеціальності розкривають деталізацію всередині відповідних галузей. Для звуження результату використайте фільтри галузей або спеціальностей.",
  dynamics:
    "Блок показує зміну показників у часі. Можна обрати потрібні дати або роки, а також додати окремі лінії за закладами, регіонами, галузями, спеціальностями, освітніми рівнями чи формами навчання."
};

function getInitialFilters(options: FilterOptions | null): DashboardFilterState {
  return {
    ...emptyFilters,
    snapshotDate: options?.dates[0] ?? "",
    snapshotDates: options?.dates[0] ? [options.dates[0]] : []
  };
}

function getAvailableYears(options: FilterOptions | null, datasetType: DashboardFilterState["datasetType"]): number[] {
  if (datasetType === "students") return [];
  return options?.yearsByDataset?.[datasetType] ?? options?.years ?? [];
}

function getLatestYearFilters(options: FilterOptions | null, datasetType: DashboardFilterState["datasetType"]) {
  const year = getAvailableYears(options, datasetType)[0];
  return {
    year: year ? String(year) : "",
    years: year ? [String(year)] : []
  };
}

export function DashboardClient({ initialOptions = null }: { initialOptions?: FilterOptions | null }) {
  const initialFilters = getInitialFilters(initialOptions);
  const [options, setOptions] = useState<FilterOptions | null>(initialOptions);
  const [draft, setDraft] = useState<DashboardFilterState>(initialFilters);
  const [filters, setFilters] = useState<DashboardFilterState>(initialFilters);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [charts, setCharts] = useState<Charts>(defaultCharts);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isChartsLoading, setIsChartsLoading] = useState(true);
  const [isDynamicsLoading, setIsDynamicsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [dynamicDateValues, setDynamicDateValues] = useState<string[]>([]);
  const [dynamicBreakdowns, setDynamicBreakdowns] = useState<DynamicsBreakdownValue[]>([]);
  const [loadedDynamicsBreakdowns, setLoadedDynamicsBreakdowns] = useState<Partial<Record<DynamicsBreakdownValue, DynamicsSeries[]>>>({});
  const [isDynamicsBreakdownLoading, setIsDynamicsBreakdownLoading] = useState(false);
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
  const fieldChartTitle =
    filters.datasetType === "entrants"
      ? "Зараховані на навчання за галуззю та спеціальністю"
      : filters.datasetType === "graduates"
      ? "Закінчили навчання за галуззю та спеціальністю"
      : "Здобувачі за галуззю та спеціальністю";
  const dynamicsChartTitle =
    filters.datasetType === "entrants"
      ? "Зараховані в динаміці"
      : filters.datasetType === "graduates"
        ? "Випускники в динаміці"
        : "Контингент в динаміці";
  const latestDateFilters = useMemo<DashboardFilterState>(
    () => ({
      ...emptyFilters,
      snapshotDate: options?.dates[0] ?? "",
      snapshotDates: options?.dates[0] ? [options.dates[0]] : [],
      ...getLatestYearFilters(options, filters.datasetType)
    }),
    [filters.datasetType, options]
  );
  const showSummaryCards = !isStudentsDataset || filters.snapshotDates.length <= 1;
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
      .catch(() => {
        setMessage("Не вдалося завантажити фільтри. Перевірте базу даних.");
        setIsSummaryLoading(false);
        setIsChartsLoading(false);
      });
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
    async function loadSummary() {
      setIsSummaryLoading(true);
      setMessage(null);
      try {
        const summaryResponse = await fetch(`/api/dashboard/summary?${params.toString()}`);
        if (!summaryResponse.ok) throw new Error("Dashboard summary API returned an error");
        const summaryData = await summaryResponse.json();
        if (!active) return;
        setSummary(summaryData);
      } catch {
        if (active) setMessage("Не вдалося оновити основні показники. Дані залишилися без змін.");
      } finally {
        if (active) setIsSummaryLoading(false);
      }
    }

    async function loadCharts() {
      setIsChartsLoading(true);
      setMessage(null);
      try {
        const chartsResponse = await fetch(`/api/dashboard/charts?${params.toString()}`);
        if (!chartsResponse.ok) throw new Error("Dashboard charts API returned an error");
        const chartsData = await chartsResponse.json();
        if (!active) return;
        setCharts((current) => ({ ...defaultCharts, ...chartsData, dynamics: current.dynamics }));
        setLoadedDynamicsBreakdowns({});
      } catch {
        if (active) setMessage("Не вдалося оновити графіки. Дані залишилися без змін.");
      } finally {
        if (active) setIsChartsLoading(false);
      }
    }

    async function loadDynamics() {
      setIsDynamicsLoading(true);
      try {
        const dynamicsResponse = await fetch(`/api/dashboard/dynamics?${params.toString()}`);
        if (!dynamicsResponse.ok) throw new Error("Dashboard dynamics API returned an error");
        const dynamicsData = await dynamicsResponse.json();
        if (!active) return;
        setCharts((current) => ({ ...current, dynamics: dynamicsData.dynamics ?? [] }));
      } catch {
        if (active) setMessage("Не вдалося оновити динаміку. Основні показники залишилися доступними.");
      } finally {
        if (active) setIsDynamicsLoading(false);
      }
    }
    loadSummary();
    loadCharts();
    loadDynamics();
    return () => {
      active = false;
    };
  }, [filters.datasetType, params]);

  useEffect(() => {
    if (!dynamicBreakdowns.length) return;
    const missingBreakdowns = dynamicBreakdowns.filter((breakdown) => !loadedDynamicsBreakdowns[breakdown]);
    if (!missingBreakdowns.length) return;

    const controller = new AbortController();
    const search = new URLSearchParams(params);
    for (const breakdown of missingBreakdowns) search.append("breakdown", breakdown);

    setIsDynamicsBreakdownLoading(true);
    fetch(`/api/dashboard/dynamics-breakdowns?${search.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Dynamics breakdown request failed");
        return response.json() as Promise<Partial<Record<DynamicsBreakdownValue, DynamicsSeries[]>>>;
      })
      .then((data) => {
        setLoadedDynamicsBreakdowns((current) => ({ ...current, ...data }));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage("Не вдалося довантажити вибрану деталізацію динаміки. Спробуйте ще раз.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsDynamicsBreakdownLoading(false);
      });

    return () => controller.abort();
  }, [dynamicBreakdowns, loadedDynamicsBreakdowns, params]);

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
            ...getLatestYearFilters(options, currentDraft.datasetType)
          };
    setDraft(next);
    setFilters(next);
  }

  function changeDatasetType(nextDatasetType: DashboardFilterState["datasetType"]) {
    const latestYears = getLatestYearFilters(options, nextDatasetType);
    const availableYearValues = new Set(getAvailableYears(options, nextDatasetType).map((year) => String(year)));
    const retainedYears = draft.years.filter((year) => availableYearValues.has(year));
    const retainedYear = draft.year && availableYearValues.has(draft.year) ? draft.year : "";
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
      year: nextDatasetType === "students" ? "" : retainedYear || latestYears.year,
      years:
        nextDatasetType === "students"
          ? []
          : retainedYears.length
            ? retainedYears
            : latestYears.years,
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
      <section className="mb-6 rounded-lg border border-line bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Аналітика відкритих освітніх даних</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Дашборд: {datasetLabels[filters.datasetType]}</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
          {datasetDescriptions[filters.datasetType]}
        </p>
      </section>

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
      {isSummaryLoading || isChartsLoading ? (
        <div className="mt-4">
          <LoadingNotice />
        </div>
      ) : null}

      {showSummaryCards ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard title={totalLabel} value={summary?.totalStudents ?? ""} isLoading={!summary} />
          <StatCard title="Закладів освіти" value={summary?.institutionsCount ?? ""} isLoading={!summary} />
          <StatCard title="Спеціальностей" value={summary?.specialitiesCount ?? ""} isLoading={!summary} />
          <StatCard title="Представлених регіонів" value={summary?.regionsCount ?? ""} isLoading={!summary} />
          {summary ? (
            <DeltaStatCard
              delta={summary.previousDelta}
              snapshotDate={filters.snapshotDate}
              year={filters.years.length === 1 ? filters.years[0] : filters.year}
            />
          ) : (
            <StatCard title="Зміна" value="" isLoading />
          )}
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <ExpandableInstitutionChartCard
          title={institutionChartTitle}
          data={charts.topInstitutions}
          totalData={charts.topInstitutionsTotal}
          selectedNames={selectedInstitutionNames}
          helpText={chartHelpTexts.institutions}
        />
        <RegionChartCard
          title={regionChartTitle}
          data={charts.regions}
          totalLabel={isStudentsDataset ? "Разом по всіх регіонах" : "Разом по обраним регіонам"}
          totalMode={isStudentsDataset ? "all" : "warning"}
          initialVisibleCount={7}
          helpText={chartHelpTexts.regions}
        />
        <RegionChartCard
          title={fieldChartTitle}
          data={charts.fields}
          totalLabel="Разом по галузям та спеціальностям"
          childGroupLabel="Спеціальності"
          helpText={chartHelpTexts.fields}
        />
        <LineChartCard
          title={dynamicsChartTitle}
          data={visibleDynamics}
          allData={charts.dynamics}
          dynamicsSeries={loadedDynamicsBreakdowns}
          selectedDateValues={dynamicDateValues}
          onDateSelectionChange={changeDynamicDates}
          breakdownOptions={dynamicsBreakdownOptions}
          selectedBreakdowns={dynamicBreakdowns}
          onBreakdownToggle={toggleDynamicBreakdown}
          isBreakdownLoading={isDynamicsLoading || isDynamicsBreakdownLoading}
          helpText={chartHelpTexts.dynamics}
        />
      </section>
    </div>
  );
}
