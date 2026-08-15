"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { LoadingNotice } from "@/components/ui/LoadingNotice";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { formatDate, formatNumber } from "@/lib/utils/format";

type SvgRegion = {
  id: string;
  name: string;
  d: string;
};

export type RegionMapStat = {
  regionId: number;
  regionName: string;
  institutionsCount: number;
  studentsCount: number;
};

export type RegionMapResponse = {
  snapshotDate: string | null;
  regions: RegionMapStat[];
};

type MapDynamicsPoint = {
  date: string;
  institutionsCount: number;
  studentsCount: number;
};

type MapDynamicsResponse = {
  points: MapDynamicsPoint[];
};

export type MapFilterChip = {
  label: string;
  value: string;
  isActive: boolean;
};

type RegionLabel = {
  x: number;
  y: number;
};

const svgRegionNames: Record<string, string> = {
  cherkasy: "Черкаська область",
  chernihiv: "Чернігівська область",
  chernivtsi: "Чернівецька область",
  crimea: "Автономна Республіка Крим",
  dnipropetrovsk: "Дніпропетровська область",
  donetsk: "Донецька область",
  "ivano-frankivsk": "Івано-Франківська область",
  kharkiv: "Харківська область",
  kherson: "Херсонська область",
  khmelnytskyi: "Хмельницька область",
  kyiv: "Київська область",
  kirovohrad: "Кіровоградська область",
  "kyiv-city": "м. Київ",
  luhansk: "Луганська область",
  lviv: "Львівська область",
  mykolaiv: "Миколаївська область",
  odessa: "Одеська область",
  poltava: "Полтавська область",
  rivne: "Рівненська область",
  sevastopol: "м. Севастополь",
  sumy: "Сумська область",
  ternopil: "Тернопільська область",
  vinnytsia: "Вінницька область",
  volyn: "Волинська область",
  zakarpattia: "Закарпатська область",
  zaporizhia: "Запорізька область",
  zhytomyr: "Житомирська область"
};

const labelPositions: Record<string, RegionLabel> = {
  volyn: { x: 150, y: 125 },
  rivne: { x: 235, y: 130 },
  zhytomyr: { x: 350, y: 165 },
  chernihiv: { x: 545, y: 110 },
  sumy: { x: 675, y: 115 },
  lviv: { x: 105, y: 240 },
  ternopil: { x: 190, y: 270 },
  khmelnytskyi: { x: 275, y: 255 },
  kyiv: { x: 500, y: 215 },
  "kyiv-city": { x: 465, y: 180 },
  poltava: { x: 645, y: 250 },
  kharkiv: { x: 790, y: 255 },
  luhansk: { x: 925, y: 310 },
  zakarpattia: { x: 80, y: 340 },
  "ivano-frankivsk": { x: 140, y: 320 },
  chernivtsi: { x: 225, y: 365 },
  vinnytsia: { x: 365, y: 305 },
  cherkasy: { x: 505, y: 275 },
  kirovohrad: { x: 540, y: 345 },
  dnipropetrovsk: { x: 710, y: 355 },
  donetsk: { x: 855, y: 385 },
  odessa: { x: 420, y: 485 },
  mykolaiv: { x: 530, y: 435 },
  kherson: { x: 625, y: 500 },
  zaporizhia: { x: 755, y: 450 },
  crimea: { x: 690, y: 600 }
};

function normalizeRegionName(value: string): string {
  return value
    .toLocaleLowerCase("uk-UA")
    .replace(/^місто\s+/, "м. ")
    .replace(/\s+область$/u, "")
    .replace(/[.'’`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type MapMetric = "institutions" | "students";

const mapHelpText =
  "Карта показує кількість закладів освіти та кількість здобувачів за регіонами відповідно до вибраних фільтрів. Щоб змінити дані на карті, налаштуйте фільтри вище та натисніть «Застосувати». Перша цифра на області - заклади освіти, друга - контингент.";

const dynamicsHelpText =
  "Блок показує, як змінювалися кількість здобувачів і кількість закладів освіти за вибраними фільтрами. Під графіком можна обрати потрібні дати для порівняння.";

function SectionTitle({ title, helpText, size = "base" }: { title: string; helpText: string; size?: "base" | "lg" }) {
  return (
    <div className="flex items-center gap-2">
      {size === "lg" ? (
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      ) : (
        <h3 className="text-base font-semibold text-ink">{title}</h3>
      )}
      <InfoTooltip text={helpText} />
    </div>
  );
}

function getFillColor(value: number, hasData: boolean, metric: MapMetric): string {
  if (!hasData) return "#f8fafc";
  const step = metric === "students" ? 5000 : 5;
  const level = Math.floor(Math.max(0, value) / step);
  const lightness = Math.max(42, 88 - level * 3);
  const hue = metric === "students" ? 43 : 217;
  const saturation = metric === "students" ? 95 : 85;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function parseUkraineSvg(svgText: string): SvgRegion[] {
  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
  return [...document.querySelectorAll("path")]
    .map((path) => ({
      id: path.getAttribute("id") ?? "",
      name: path.getAttribute("aria-label") ?? "",
      d: path.getAttribute("d") ?? ""
    }))
    .filter((region) => region.id && region.d);
}

function buildDynamicsQuery(query: string): string {
  const params = new URLSearchParams(query);
  ["date", "page", "pageSize", "sort", "direction"].forEach((key) => params.delete(key));
  return params.toString();
}

function appendClientCacheVersion(query: string): string {
  const params = new URLSearchParams(query);
  params.set("mapClientVersion", "2");
  return params.toString();
}

async function fetchJsonWithRetry<T>(url: string, signal: AbortSignal, attempts = 2): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 450 + attempt * 700));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export function InteractiveEducationMap({
  query,
  isReady,
  selectedRegionIds,
  filterChips,
  onDataChange
}: {
  query: string;
  isReady: boolean;
  selectedRegionIds: number[];
  filterChips: MapFilterChip[];
  onDataChange?: (data: RegionMapResponse | null) => void;
}) {
  const [regions, setRegions] = useState<SvgRegion[]>([]);
  const [data, setData] = useState<RegionMapResponse | null>(null);
  const [dynamics, setDynamics] = useState<MapDynamicsResponse | null>(null);
  const [selectedDynamicsDates, setSelectedDynamicsDates] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [dynamicsError, setDynamicsError] = useState("");
  const [mapMetric, setMapMetric] = useState<MapMetric>("institutions");
  const isSelectedMode = selectedRegionIds.length > 0;
  const dynamicsQuery = useMemo(() => buildDynamicsQuery(query), [query]);
  const mapRequestQuery = useMemo(() => appendClientCacheVersion(query), [query]);
  const dynamicsRequestQuery = useMemo(() => appendClientCacheVersion(dynamicsQuery), [dynamicsQuery]);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/maps/ukraine.svg", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Map geometry request failed");
        return response.text();
      })
      .then((svgText) => setRegions(parseUkraineSvg(svgText)))
      .catch((mapError) => {
        if (mapError instanceof DOMException && mapError.name === "AbortError") return;
        setError("Не вдалося завантажити карту України.");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isReady) {
      setData(null);
      onDataChange?.(null);
      return;
    }

    const controller = new AbortController();
    setError("");
    setData(null);
    onDataChange?.(null);

    fetchJsonWithRetry<RegionMapResponse>(`/api/institutions/map?${mapRequestQuery}`, controller.signal, 3)
      .then((nextData) => {
        setData(nextData);
        onDataChange?.(nextData);
      })
      .catch((mapError) => {
        if (mapError instanceof DOMException && mapError.name === "AbortError") return;
        setError("Не вдалося завантажити дані для карти.");
        onDataChange?.(null);
      });

    return () => controller.abort();
  }, [isReady, mapRequestQuery, onDataChange]);

  useEffect(() => {
    if (!isReady || !data) {
      setDynamics(null);
      setSelectedDynamicsDates([]);
      return;
    }

    const controller = new AbortController();
    setDynamicsError("");
    setDynamics(null);
    setSelectedDynamicsDates([]);

    const timeoutId = window.setTimeout(() => {
      fetchJsonWithRetry<MapDynamicsResponse>(`/api/institutions/map/dynamics?${dynamicsRequestQuery}`, controller.signal, 2)
        .then((nextData) => {
          setDynamics(nextData);
          setSelectedDynamicsDates(nextData.points.map((point) => point.date));
        })
        .catch((mapError) => {
          if (mapError instanceof DOMException && mapError.name === "AbortError") return;
          setDynamicsError("Не вдалося завантажити динаміку для EdМапи.");
        });
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [data, dynamicsRequestQuery, isReady]);

  const statsByRegion = useMemo(() => {
    const entries = data?.regions.map((region) => [normalizeRegionName(region.regionName), region] as const) ?? [];
    return new Map(entries);
  }, [data?.regions]);
  const regionsShownOnMap = useMemo(
    () => new Set(regions.map((region) => normalizeRegionName(svgRegionNames[region.id] ?? region.name))),
    [regions]
  );
  const regionsWithoutMapShape = useMemo(
    () => (data?.regions ?? []).filter((region) => !regionsShownOnMap.has(normalizeRegionName(region.regionName))),
    [data?.regions, regionsShownOnMap]
  );

  const totalInstitutions = data?.regions.reduce((sum, region) => sum + region.institutionsCount, 0) ?? 0;
  const totalStudents = data?.regions.reduce((sum, region) => sum + region.studentsCount, 0) ?? 0;
  const dynamicDateOptions = useMemo(
    () => (dynamics?.points ?? [])
      .slice()
      .sort((first, second) => Date.parse(second.date) - Date.parse(first.date))
      .map((point) => ({ value: point.date, label: formatDate(point.date) })),
    [dynamics?.points]
  );
  const selectedDynamicsDateSet = useMemo(() => new Set(selectedDynamicsDates), [selectedDynamicsDates]);
  const dynamicChartData = useMemo(
    () => (dynamics?.points ?? [])
      .filter((point) => selectedDynamicsDateSet.has(point.date))
      .sort((first, second) => Date.parse(first.date) - Date.parse(second.date))
      .map((point) => ({
        date: point.date,
        label: formatDate(point.date),
        studentsCount: point.studentsCount,
        institutionsCount: point.institutionsCount
      })),
    [dynamics?.points, selectedDynamicsDateSet]
  );

  return (
    <>
    <section className="mb-6 rounded-lg border border-line bg-white p-5 shadow-soft ring-1 ring-white/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle title="Інтерактивна карта освіти" helpText={mapHelpText} size="lg" />
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
            Карта показує кількість закладів освіти та контингент за регіонами відповідно до обраних фільтрів.
          </p>
        </div>
        <div className="rounded-md border border-line bg-slate-50 px-3 py-2 text-right text-xs text-muted">
          <div>{data?.snapshotDate ? `Станом на ${formatDate(data.snapshotDate)}` : "Дата визначається фільтрами"}</div>
          <div className="mt-1 font-semibold text-slate-800">
            Закладів освіти: {formatNumber(totalInstitutions)}
          </div>
          <div className="mt-1 font-semibold text-slate-800">
            Кількість здобувачів: {formatNumber(totalStudents)}
          </div>
        </div>
      </div>

      {filterChips.length ? (
        <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Показано за фільтрами</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {filterChips.map((chip) => (
              <span
                key={chip.label}
                className={
                  chip.isActive
                    ? "inline-flex items-center gap-1 rounded-md border border-brand-200 bg-white px-2.5 py-1 text-xs text-brand-800"
                    : "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
                }
              >
                <span className="font-semibold">{chip.label}:</span>
                <span>{chip.value}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {!regions.length || !data ? (
        <div className="mt-4">
          <LoadingNotice text="Оновлюю карту освіти, зачекайте декілька секунд..." />
        </div>
      ) : (
        <div className="relative mt-4 overflow-hidden rounded-lg border border-line bg-slate-50 p-3">
          <svg
            role="img"
            aria-label="Карта України з показниками закладів освіти та контингенту"
            viewBox="0 0 1000 670"
            className="mx-auto block h-auto w-full max-w-5xl"
          >
            <rect width="1000" height="670" fill="#f8fafc" rx="18" />
            <g>
              {regions.map((region) => {
                const ukrainianName = svgRegionNames[region.id] ?? region.name;
                const stat = statsByRegion.get(normalizeRegionName(ukrainianName));
                const hasData = Boolean(stat);
                const shouldShowData = !isSelectedMode || hasData;
                const colorValue = mapMetric === "students" ? stat?.studentsCount ?? 0 : stat?.institutionsCount ?? 0;
                const fill = shouldShowData ? getFillColor(colorValue, hasData, mapMetric) : "#ffffff";
                const stroke = isSelectedMode && hasData ? (mapMetric === "students" ? "#92400e" : "#0f3ea8") : "#475569";

                return (
                  <path
                    key={region.id}
                    data-region-id={region.id}
                    d={region.d}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelectedMode && hasData ? 2.7 : 1.65}
                    vectorEffect="non-scaling-stroke"
                    className="transition-colors duration-200"
                  >
                    <title>
                      {ukrainianName}
                      {stat ? `, закладів - ${formatNumber(stat.institutionsCount)}, осіб - ${formatNumber(stat.studentsCount)}` : ""}
                    </title>
                  </path>
                );
              })}
            </g>
            <g>
              {regions.map((region) => {
                const ukrainianName = svgRegionNames[region.id] ?? region.name;
                const stat = statsByRegion.get(normalizeRegionName(ukrainianName));
                const label = labelPositions[region.id];
                const shouldShowData = (!isSelectedMode || stat) && stat && label;
                if (!shouldShowData) return null;

                return (
                  <text
                    key={`${region.id}-label`}
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    paintOrder="stroke"
                    stroke="#ffffff"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    className="pointer-events-none select-none fill-slate-950"
                  >
                    <tspan x={label.x} dy="0" className="text-[13px] font-extrabold">
                      {formatNumber(stat.institutionsCount)}
                    </tspan>
                    <tspan x={label.x} dy="15" className="text-[11px] font-bold">
                      {formatNumber(stat.studentsCount)}
                    </tspan>
                  </text>
                );
              })}
            </g>
          </svg>
          {regionsWithoutMapShape.length ? (
            <div className="absolute bottom-4 left-4 max-w-[260px] rounded-md border border-line bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-soft backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Поза картою</div>
              <div className="mt-1 space-y-1">
                {regionsWithoutMapShape.map((region) => (
                  <div key={region.regionId}>
                    <div className="font-semibold text-slate-900">{region.regionName}</div>
                    <div>закладів - {formatNumber(region.institutionsCount)}, осіб - {formatNumber(region.studentsCount)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
      <label className="mt-3 inline-flex w-fit items-center gap-2 rounded-md border border-line bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={mapMetric === "students"}
          onChange={(event) => setMapMetric(event.target.checked ? "students" : "institutions")}
          className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
        />
        Карта за здобувачами
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className={`h-3 w-6 rounded-sm ${mapMetric === "students" ? "bg-amber-500" : "bg-brand-600"}`} /> Більше значення
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={`h-3 w-6 rounded-sm ${mapMetric === "students" ? "bg-amber-100" : "bg-brand-100"}`} /> Менше значення
        </span>
        <span>Перша цифра - заклади освіти, друга - контингент.</span>
      </div>
    </section>

    <section className="mb-6 rounded-lg border border-line bg-white p-5 shadow-soft ring-1 ring-white/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle title="Показники в динаміці" helpText={dynamicsHelpText} />
            <p className="mt-1 text-sm leading-6 text-muted">
              Графік показує зміну контингенту та кількості закладів освіти за вибраними фільтрами.
            </p>
          </div>
        </div>
        {dynamicsError ? <p className="mt-4 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{dynamicsError}</p> : null}
        {!dynamics ? (
          <div className="mt-4">
            <LoadingNotice text="Оновлюю динаміку EdМапи, зачекайте декілька секунд..." />
          </div>
        ) : dynamicChartData.length ? (
          <div className="mt-4 h-96 rounded-lg border border-line bg-slate-50 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dynamicChartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="students"
                  orientation="left"
                  width={92}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatNumber(Number(value))}
                />
                <YAxis
                  yAxisId="institutions"
                  orientation="right"
                  width={64}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatNumber(Number(value))}
                />
                <Tooltip formatter={(value: number | string, name) => [formatNumber(Number(value)), name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="students"
                  type="monotone"
                  dataKey="studentsCount"
                  name="Контингент"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="institutions"
                  type="monotone"
                  dataKey="institutionsCount"
                  name="Заклади освіти"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-line bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-700">
            Завантаження даних
          </div>
        )}
        {dynamicDateOptions.length ? (
          <div className="mt-4">
            <MapDateMultiSelect
              options={dynamicDateOptions}
              selectedValues={selectedDynamicsDates}
              onChange={setSelectedDynamicsDates}
            />
          </div>
        ) : null}
    </section>
    </>
  );
}

function MapDateMultiSelect({
  options,
  selectedValues,
  onChange
}: {
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onChange: (values: string[]) => void;
}) {
  const detailsRef = useAutoCloseMapDetails();
  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));
  const labelText = selectedOptions.length === options.length
    ? "Усі дати"
    : selectedOptions.length === 0
      ? "Обрано дат: 0"
      : selectedOptions.length <= 2
        ? selectedOptions.map((option) => option.label).join(", ")
        : `Обрано дат: ${selectedOptions.length}`;

  function toggleValue(value: string, checked: boolean) {
    if (checked) {
      onChange(selectedValues.includes(value) ? selectedValues : [...selectedValues, value]);
      return;
    }
    onChange(selectedValues.filter((item) => item !== value));
  }

  function toggleAll() {
    onChange(selectedOptions.length === options.length ? [] : options.map((option) => option.value));
  }

  return (
    <div className="relative max-w-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Дати</div>
      <details ref={detailsRef} className="group relative mt-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none hover:bg-slate-50 focus:border-brand-500">
          <span className="truncate">{labelText}</span>
          <span className="text-xs text-muted group-open:rotate-180">▼</span>
        </summary>
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-md border border-line bg-white p-2 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={!selectedOptions.length}
            className="mb-2 w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Скинути
          </button>
          <button
            type="button"
            onClick={toggleAll}
            className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-medium hover:bg-slate-50 ${
              selectedOptions.length === options.length ? "bg-brand-50 text-brand-800" : "text-slate-700"
            }`}
          >
            <input
              type="checkbox"
              readOnly
              checked={selectedOptions.length === options.length}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>Усі дати</span>
          </button>
          <div className="my-1 border-t border-line" />
          {options.map((option) => (
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
        </div>
      </details>
    </div>
  );
}

function useAutoCloseMapDetails() {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;
      if (!details?.open || !(event.target instanceof Node)) return;
      if (!details.contains(event.target)) {
        details.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return detailsRef;
}
