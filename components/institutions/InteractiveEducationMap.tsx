"use client";

import { useEffect, useMemo, useState } from "react";
import { LoadingNotice } from "@/components/ui/LoadingNotice";
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

function getFillColor(value: number, maxValue: number, isSelectedMode: boolean, hasData: boolean, metric: MapMetric): string {
  if (!hasData) return "#f8fafc";
  if (isSelectedMode) return metric === "students" ? "#f59e0b" : "#2563eb";
  const ratio = maxValue > 0 ? value / maxValue : 0;
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const lightness = 88 - clampedRatio * 42;
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

export function InteractiveEducationMap({
  query,
  selectedRegionIds,
  filterChips,
  onDataChange
}: {
  query: string;
  selectedRegionIds: number[];
  filterChips: MapFilterChip[];
  onDataChange?: (data: RegionMapResponse | null) => void;
}) {
  const [regions, setRegions] = useState<SvgRegion[]>([]);
  const [data, setData] = useState<RegionMapResponse | null>(null);
  const [error, setError] = useState("");
  const [mapMetric, setMapMetric] = useState<MapMetric>("institutions");
  const isSelectedMode = selectedRegionIds.length > 0;

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
    const controller = new AbortController();
    setError("");
    setData(null);
    onDataChange?.(null);

    fetch(`/api/institutions/map${query ? `?${query}` : ""}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Map data request failed");
        return response.json() as Promise<RegionMapResponse>;
      })
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
  }, [onDataChange, query]);

  const statsByRegion = useMemo(() => {
    const entries = data?.regions.map((region) => [normalizeRegionName(region.regionName), region] as const) ?? [];
    return new Map(entries);
  }, [data?.regions]);

  const maxInstitutions = Math.max(0, ...(data?.regions.map((region) => region.institutionsCount) ?? []));
  const maxStudents = Math.max(0, ...(data?.regions.map((region) => region.studentsCount) ?? []));
  const mapMetricMaxValue = mapMetric === "students" ? maxStudents : maxInstitutions;
  const totalInstitutions = data?.regions.reduce((sum, region) => sum + region.institutionsCount, 0) ?? 0;
  const totalStudents = data?.regions.reduce((sum, region) => sum + region.studentsCount, 0) ?? 0;

  return (
    <section className="mb-6 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Інтерактивна карта освіти</h2>
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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-slate-50 px-3 py-2">
        <p className="text-xs leading-5 text-muted">
          Колір карти: {mapMetric === "students" ? "за кількістю здобувачів" : "за кількістю закладів освіти"}.
        </p>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={mapMetric === "students"}
            onChange={(event) => setMapMetric(event.target.checked ? "students" : "institutions")}
            className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
          />
          Фарбувати за кількістю здобувачів
        </label>
      </div>
      {!regions.length || !data ? (
        <div className="mt-4">
          <LoadingNotice text="Оновлюю карту освіти, зачекайте декілька секунд..." />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-slate-50 p-3">
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
                const fill = shouldShowData
                  ? getFillColor(colorValue, mapMetricMaxValue, isSelectedMode, hasData, mapMetric)
                  : "#ffffff";
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
        </div>
      )}
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
  );
}
