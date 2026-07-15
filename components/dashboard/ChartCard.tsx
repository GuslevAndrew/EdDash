"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { formatDate, formatNumber } from "@/lib/utils/format";

export type ChartDatum = {
  name: string;
  value: number;
  series?: Array<{ label: string; value: number }>;
  tone?: "default" | "selected" | "warning";
  children?: ChartDatum[];
};

export type PieChartGroup = {
  title: string;
  description?: string;
  data: ChartDatum[];
};

const colors = ["#2563eb", "#059669", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#4f46e5", "#16a34a"];
const initialVisibleBars = 10;
const visibleBarsStep = 10;

function tooltipFormatter(value: number | string) {
  return [formatNumber(Number(value)), "Кількість здобувачів"];
}

function formatSeriesLabel(value: string): string {
  return /^\d{4}$/.test(value) ? value : formatDate(value);
}

export function BarChartCard({ title, data }: { title: string; data: ChartDatum[] }) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {data.length ? (
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => formatNumber(Number(value))} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState title="Дані не знайдено" description="Змініть фільтри або завантажте демонстраційні дані." />
      )}
    </article>
  );
}

export function ExpandableInstitutionChartCard({
  title,
  data,
  totalData,
  selectedNames = []
}: {
  title: string;
  data: ChartDatum[];
  totalData?: ChartDatum[];
  selectedNames?: string[];
}) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleBars);
  const totalSourceData = totalData?.length ? totalData : data;
  const selectedNameSet = useMemo(() => new Set(selectedNames), [selectedNames]);
  const selectedData = useMemo(
    () => selectedNames.map((name) => data.find((item) => item.name === name) ?? { name, value: 0 }),
    [data, selectedNames]
  );
  const rankedData = useMemo(() => data.filter((item) => !selectedNameSet.has(item.name)), [data, selectedNameSet]);
  const totalItem = useMemo<ChartDatum | null>(() => {
    if (!totalSourceData.length) return null;
    const dateLabels = [...new Set(totalSourceData.flatMap((item) => item.series?.map((seriesItem) => seriesItem.label) ?? []))];

    if (dateLabels.length) {
      const series = dateLabels.map((label) => ({
        label,
        value: totalSourceData.reduce((sum, item) => sum + (item.series?.find((seriesItem) => seriesItem.label === label)?.value ?? 0), 0)
      }));
      return {
        name: "Разом по всіх закладах",
        value: series[0]?.value ?? series.reduce((sum, item) => sum + item.value, 0),
        series
      };
    }

    return {
      name: "Разом по всіх закладах",
      value: totalSourceData.reduce((sum, item) => sum + item.value, 0)
    };
  }, [totalSourceData]);
  const maxValue = useMemo(
    () =>
      Math.max(
        ...data.flatMap((item) => [item.value, ...(item.series?.map((seriesItem) => seriesItem.value) ?? [])]),
        ...selectedData.flatMap((item) => [item.value, ...(item.series?.map((seriesItem) => seriesItem.value) ?? [])]),
        0
      ),
    [data, selectedData]
  );
  const visibleData = rankedData.slice(0, visibleCount);
  const hiddenCount = Math.max(0, rankedData.length - visibleData.length);

  useEffect(() => {
    setVisibleCount(initialVisibleBars);
  }, [data, selectedNames]);

  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-soft xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {data.length || selectedData.length ? (
            <p className="mt-1 text-sm text-muted">
              Показано {formatNumber(visibleData.length + selectedData.length)} з {formatNumber(data.length)} закладів за поточними фільтрами.
            </p>
          ) : null}
        </div>
      </div>

      {visibleData.length || selectedData.length ? (
        <div className="mt-5 space-y-3">
          {totalItem ? <InstitutionBar item={totalItem} maxValue={totalItem.value || maxValue} totalItem={totalItem} tone="total" /> : null}

          {selectedData.map((item) => (
            <InstitutionBar key={`selected-${item.name}`} item={item} maxValue={maxValue} totalItem={totalItem} tone="selected" />
          ))}

          {visibleData.map((item, index) => (
            <InstitutionBar key={`${item.name}-${index}`} item={item} maxValue={maxValue} totalItem={totalItem} index={index + 1} />
          ))}

          {hiddenCount ? (
            <div className="pt-2">
              <Button variant="secondary" onClick={() => setVisibleCount((current) => current + visibleBarsStep)}>
                Показати ще
              </Button>
              <span className="ml-3 text-sm text-muted">Залишилось: {formatNumber(hiddenCount)}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState title="Дані не знайдено" description="Змініть фільтри або завантажте дані за потрібний зріз." />
      )}
    </article>
  );
}

export function RegionChartCard({
  title,
  data,
  totalLabel = "Разом по всіх закладах",
  childGroupLabel = "ЗВО",
  initialVisibleCount,
  totalMode = "all"
}: {
  title: string;
  data: ChartDatum[];
  totalLabel?: string;
  childGroupLabel?: string;
  initialVisibleCount?: number;
  totalMode?: "all" | "warning";
}) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount ?? data.length);
  const totalItem = useMemo<ChartDatum | null>(() => {
    if (!data.length) return null;
    const totalData = totalMode === "warning" && data.some((item) => item.tone === "warning")
      ? data.filter((item) => item.tone === "warning")
      : data;
    const dateLabels = [...new Set(totalData.flatMap((item) => item.series?.map((seriesItem) => seriesItem.label) ?? []))];

    if (dateLabels.length) {
      const series = dateLabels.map((label) => ({
        label,
        value: totalData.reduce((sum, item) => sum + (item.series?.find((seriesItem) => seriesItem.label === label)?.value ?? 0), 0)
      }));
      return {
        name: totalLabel,
        value: series[0]?.value ?? series.reduce((sum, item) => sum + item.value, 0),
        series
      };
    }

    return {
      name: totalLabel,
      value: totalData.reduce((sum, item) => sum + item.value, 0)
    };
  }, [data, totalLabel, totalMode]);
  const maxValue = useMemo(
    () =>
      Math.max(
        ...data.flatMap((item) => [
          item.value,
          ...(item.series?.map((seriesItem) => seriesItem.value) ?? []),
          ...(item.children?.flatMap((child) => [child.value, ...(child.series?.map((seriesItem) => seriesItem.value) ?? [])]) ?? [])
        ]),
        0
      ),
    [data]
  );
  const visibleData = initialVisibleCount ? data.slice(0, visibleCount) : data;
  const hiddenCount = initialVisibleCount ? Math.max(0, data.length - visibleData.length) : 0;

  useEffect(() => {
    setVisibleCount(initialVisibleCount ?? data.length);
  }, [data, initialVisibleCount]);

  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-soft xl:col-span-2">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {data.length ? (
        <div className="mt-4 space-y-2.5">
          {totalItem ? <RegionBar item={totalItem} maxValue={totalItem.value || maxValue} totalItem={totalItem} childGroupLabel={childGroupLabel} isTotal /> : null}
          {visibleData.map((item) => (
            <RegionBar key={item.name} item={item} maxValue={maxValue} totalItem={totalItem} childGroupLabel={childGroupLabel} />
          ))}
          {hiddenCount ? (
            <div className="pt-2">
              <Button variant="secondary" onClick={() => setVisibleCount((current) => current + visibleBarsStep)}>
                Показати ще
              </Button>
              <span className="ml-3 text-sm text-muted">Залишилось: {formatNumber(hiddenCount)}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState title="Дані не знайдено" description="Змініть фільтри або завантажте дані за потрібний зріз." />
      )}
    </article>
  );
}

function RegionBar({
  item,
  maxValue,
  totalItem,
  childGroupLabel,
  isTotal = false
}: {
  item: ChartDatum;
  maxValue: number;
  totalItem: ChartDatum | null;
  childGroupLabel: string;
  isTotal?: boolean;
}) {
  return (
    <div className={isTotal ? "space-y-1 rounded-md bg-slate-50 p-2" : "space-y-1"}>
      <div className={`text-sm font-semibold leading-5 ${isTotal ? "text-slate-900" : "text-ink"}`}>
        {item.name}
      </div>
      <RegionSeries
        item={item}
        maxValue={maxValue}
        totalItem={totalItem}
        tone={item.tone === "warning" ? "warning" : "default"}
        compact={false}
        isTotal={isTotal}
      />

      {item.children?.length ? (
        <div className="mt-2 space-y-1.5 border-l border-rose-200 pl-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-rose-700">{childGroupLabel}</div>
          {item.children.map((child) => (
            <div key={`${item.name}-${child.name}`} className="space-y-1">
              <div className="text-xs font-semibold leading-4 text-rose-800">{child.name}</div>
              <RegionSeries item={child} maxValue={maxValue} totalItem={item} tone="selected" compact />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RegionSeries({
  item,
  maxValue,
  totalItem,
  tone,
  compact = false,
  isTotal = false
}: {
  item: ChartDatum;
  maxValue: number;
  totalItem: ChartDatum | null;
  tone: "default" | "selected" | "warning";
  compact?: boolean;
  isTotal?: boolean;
}) {
  const series = item.series?.length ? item.series : [{ label: "", value: item.value }];
  const barColor = isTotal ? "bg-slate-700" : tone === "selected" ? "bg-rose-600" : tone === "warning" ? "bg-amber-500" : "bg-brand-600";
  const trackColor = isTotal ? "bg-slate-200" : tone === "selected" ? "bg-rose-50" : tone === "warning" ? "bg-amber-50" : "bg-slate-100";
  const height = compact ? "h-4" : isTotal ? "h-7" : "h-5";

  return (
    <div className="space-y-1">
      {series.map((seriesItem) => {
        const width = maxValue > 0 ? (seriesItem.value / maxValue) * 100 : 0;
        const hasDateLabel = Boolean(seriesItem.label);
        const totalValue = hasDateLabel
          ? totalItem?.series?.find((totalSeriesItem) => totalSeriesItem.label === seriesItem.label)?.value
          : totalItem?.value;
        const percent = totalValue && totalValue > 0 ? (seriesItem.value / totalValue) * 100 : null;
        return (
          <div
            key={seriesItem.label || item.name}
            className={
              isTotal && hasDateLabel
                ? "grid gap-1.5 sm:grid-cols-[4.8rem_minmax(0,1fr)] sm:items-center"
                : isTotal
                  ? "block"
                  : hasDateLabel
                ? "grid gap-1.5 sm:grid-cols-[4.8rem_minmax(0,1fr)_7.5rem] sm:items-center"
                : "grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-1.5"
            }
          >
            {hasDateLabel ? <span className="text-[11px] font-medium leading-4 text-slate-500">{formatSeriesLabel(seriesItem.label)}</span> : null}
            <div className={`${height} rounded-md ${trackColor}`}>
              <div
                className={`flex ${height} items-center justify-end rounded-md px-2 text-xs font-semibold text-white ${barColor}`}
                style={{ width: `${width}%`, minWidth: seriesItem.value > 0 ? "2px" : undefined, maxWidth: "100%" }}
              >
                {isTotal ? formatNumber(seriesItem.value) : null}
              </div>
            </div>
            {!isTotal ? (
              <span className="text-right text-[11px] font-semibold leading-4 text-slate-700">
                {formatNumber(seriesItem.value)}
                {percent !== null ? <span className="font-medium text-slate-500"> ({percent.toFixed(1)}%)</span> : null}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function InstitutionBar({
  item,
  maxValue,
  totalItem,
  index,
  tone = "default"
}: {
  item: ChartDatum;
  maxValue: number;
  totalItem?: ChartDatum | null;
  index?: number;
  tone?: "default" | "selected" | "total";
}) {
  const width = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
  const barColor = tone === "selected" ? "bg-rose-600" : tone === "total" ? "bg-slate-700" : "bg-brand-600";
  const trackColor = tone === "total" ? "bg-slate-200" : "bg-slate-100";
  const nameColor = tone === "selected" ? "text-rose-800" : tone === "total" ? "text-slate-900" : "text-ink";
  const leftOffset = index ? "ml-11" : "ml-0";
  const series = item.series?.length ? item.series : [{ label: "", value: item.value }];

  return (
    <div className={tone === "total" ? "space-y-1 rounded-md bg-slate-50 p-2" : "space-y-1"}>
      <div className="flex items-start gap-3 text-sm">
        {index ? <span className="w-8 shrink-0 text-right font-semibold text-slate-500">{index}.</span> : null}
        <span className={`min-w-0 flex-1 font-medium leading-5 ${nameColor}`}>{item.name}</span>
      </div>
      <div className={`${leftOffset} space-y-1.5`}>
        {series.map((seriesItem) => {
          const seriesWidth = maxValue > 0 ? (seriesItem.value / maxValue) * 100 : width;
          const hasDateLabel = Boolean(seriesItem.label);
          const totalValue = hasDateLabel
            ? totalItem?.series?.find((totalSeriesItem) => totalSeriesItem.label === seriesItem.label)?.value
            : totalItem?.value;
          const percent = totalValue && totalValue > 0 ? (seriesItem.value / totalValue) * 100 : null;
          const label = `${formatNumber(seriesItem.value)}${percent !== null && tone !== "total" ? ` (${percent.toFixed(2)}%)` : ""}`;
          const showLabelInside = tone === "total" || seriesWidth >= 24;

          return (
            <div
              key={seriesItem.label || item.name}
              className={hasDateLabel ? "grid gap-2 sm:grid-cols-[5.5rem_1fr] sm:items-center" : "block"}
            >
              {hasDateLabel ? <span className="text-xs font-medium text-slate-500">{formatSeriesLabel(seriesItem.label)}</span> : null}
              <div className={`relative h-7 rounded-md ${trackColor}`}>
                <div
                  className={`flex h-7 items-center justify-end rounded-md px-2 text-xs font-semibold text-white ${barColor}`}
                  style={{ width: `${seriesWidth}%`, minWidth: seriesItem.value > 0 ? "2px" : undefined, maxWidth: "100%" }}
                >
                  {showLabelInside ? label : null}
                </div>
                {!showLabelInside ? (
                  <span
                    className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold text-slate-700"
                    style={{ left: `min(calc(${seriesWidth}% + 0.5rem), calc(100% - 7.5rem))` }}
                  >
                    {label}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
        </div>
    </div>
  );
}

export type DynamicsBreakdownValue = "institutions" | "regions" | "fields" | "specialities" | "educationLevels" | "studyForms";
export type DynamicsSeries = {
  id: string;
  name: string;
  points: Array<{ date: string; value: number }>;
};

type DynamicsBreakdownOption = {
  value: DynamicsBreakdownValue;
  label: string;
};

type MiniOption = {
  value: string;
  label: string;
};

export function LineChartCard({
  title,
  data,
  allData = data,
  dynamicsSeries = {},
  selectedDateValues,
  onDateSelectionChange,
  breakdownOptions = [],
  selectedBreakdowns = [],
  onBreakdownToggle,
  isBreakdownLoading = false
}: {
  title: string;
  data: ChartDatum[];
  allData?: ChartDatum[];
  dynamicsSeries?: Partial<Record<DynamicsBreakdownValue, DynamicsSeries[]>>;
  selectedDateValues?: string[];
  onDateSelectionChange?: (dateValues: string[]) => void;
  breakdownOptions?: DynamicsBreakdownOption[];
  selectedBreakdowns?: DynamicsBreakdownValue[];
  onBreakdownToggle?: (value: DynamicsBreakdownValue, checked: boolean) => void;
  isBreakdownLoading?: boolean;
}) {
  const [hoveredLineKey, setHoveredLineKey] = useState<string | null>(null);
  const prepared = data.map((item) => ({ ...item, label: /^\d{4}$/.test(item.name) ? item.name : formatDate(item.name) }));
  const dateOptions = [...allData]
    .sort((first, second) => {
      const firstTime = Date.parse(first.name);
      const secondTime = Date.parse(second.name);
      if (Number.isNaN(firstTime) || Number.isNaN(secondTime)) return second.name.localeCompare(first.name, "uk-UA");
      return secondTime - firstTime;
    })
    .map((item) => ({
      value: item.name,
      label: /^\d{4}$/.test(item.name) ? item.name : formatDate(item.name)
    }));
  const activeSeries = selectedBreakdowns.flatMap((breakdown) => dynamicsSeries[breakdown] ?? []);
  const chartHeight = activeSeries.length ? "h-[34rem]" : "h-80";
  const lineData = prepared.map((item) => {
    const row: Record<string, string | number> = {
      label: item.label,
      total: item.value
    };

    for (const series of activeSeries) {
      row[series.id] = series.points.find((point) => point.date === item.name)?.value ?? 0;
    }

    return row;
  });
  const linePalette = [
    "#2563eb",
    "#dc2626",
    "#059669",
    "#f59e0b",
    "#7c3aed",
    "#0891b2",
    "#4f46e5",
    "#16a34a",
    "#be123c",
    "#0f766e",
    "#9333ea",
    "#ea580c",
    "#0284c7",
    "#65a30d",
    "#db2777",
    "#475569",
    "#ca8a04",
    "#0d9488",
    "#7f1d1d",
    "#3730a3"
  ];
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-soft xl:col-span-2">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {prepared.length ? (
        <div className={`mt-4 ${chartHeight}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ left: 8, right: 16, top: 8, bottom: activeSeries.length ? 24 : 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis width={92} tick={{ fontSize: 12 }} tickFormatter={(value) => formatNumber(Number(value))} />
              <Tooltip content={<LineTooltip hoveredDataKey={activeSeries.length ? hoveredLineKey : "total"} />} />
              {activeSeries.length ? <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 12 }} /> : null}
              {!activeSeries.length ? (
                <Line type="monotone" dataKey="total" name="Усього" stroke={linePalette[0]} strokeWidth={3} dot={{ r: 3 }} />
              ) : null}
              {activeSeries.map((series, index) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.id}
                  name={series.name}
                  stroke={linePalette[(index + 1) % linePalette.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5, onMouseEnter: () => setHoveredLineKey(series.id) }}
                  onMouseEnter={() => setHoveredLineKey(series.id)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState title="Немає динаміки" description="Для графіка потрібен хоча б один доступний зріз." />
      )}
      {dateOptions.length || breakdownOptions.length ? (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {dateOptions.length ? (
            <MiniMultiSelect
              label="Дати"
              allLabel="Усі дати"
              selectedLabel="Обрано дат"
              options={dateOptions}
              selectedValues={selectedDateValues ?? dateOptions.map((option) => option.value)}
              onChange={onDateSelectionChange}
              onReset={() => onDateSelectionChange?.([])}
              disableSearch
              showResetButton
            />
          ) : null}
          {breakdownOptions.length ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Показати в динаміці</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {breakdownOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBreakdowns.includes(option.value)}
                      onChange={(event) => onBreakdownToggle?.(option.value, event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              {activeSeries.length ? (
                <p className="mt-2 text-xs text-muted">
                  Додано ліній: {formatNumber(activeSeries.length)}.
                </p>
              ) : null}
              {isBreakdownLoading ? (
                <p className="mt-2 text-xs text-muted">Оновлюю деталізацію динаміки, зачекайте кілька секунд...</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

type LineTooltipPayloadItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: string | number;
  color?: string;
  stroke?: string;
};

function LineTooltip({
  active,
  label,
  payload,
  hoveredDataKey
}: {
  active?: boolean;
  label?: string | number;
  payload?: LineTooltipPayloadItem[];
  hoveredDataKey: string | null;
}) {
  if (!active || !payload?.length || !hoveredDataKey) return null;

  const item = payload.find((payloadItem) => String(payloadItem.dataKey) === hoveredDataKey);

  if (!item) return null;

  const color = item.color ?? item.stroke ?? "#2563eb";

  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-lg">
      {label ? <div className="mb-1 font-semibold text-slate-900">{label}</div> : null}
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="max-w-xs text-slate-700">{item.name}</span>
      </div>
      <div className="mt-1 text-sm font-bold text-slate-900">{formatNumber(Number(item.value ?? 0))}</div>
    </div>
  );
}

function MiniMultiSelect({
  label,
  allLabel,
  selectedLabel,
  options,
  selectedValues,
  onChange,
  onReset,
  disableSearch = false,
  showResetButton = false
}: {
  label: string;
  allLabel: string;
  selectedLabel: string;
  options: MiniOption[];
  selectedValues: string[];
  onChange?: (selectedValues: string[]) => void;
  onReset?: () => void;
  disableSearch?: boolean;
  showResetButton?: boolean;
}) {
  const [query, setQuery] = useState("");
  const detailsRef = useAutoCloseDetails();
  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));
  const labelText = selectedOptions.length === options.length
    ? allLabel
    : selectedOptions.length === 0
      ? `${selectedLabel}: 0`
      : selectedOptions.length <= 2
      ? selectedOptions.map((option) => option.label).join(", ")
      : `${selectedLabel}: ${selectedOptions.length}`;
  const filteredOptions = query
    ? options.filter((option) => option.label.toLocaleLowerCase("uk-UA").includes(query.toLocaleLowerCase("uk-UA").trim()))
    : options;

  function toggleValue(value: string, checked: boolean) {
    if (!onChange) return;
    if (checked) {
      onChange(selectedValues.includes(value) ? selectedValues : [...selectedValues, value]);
      return;
    }
    onChange(selectedValues.filter((item) => item !== value));
  }

  function toggleAll() {
    if (!onChange) return;
    onChange(selectedOptions.length === options.length ? [] : options.map((option) => option.value));
  }

  function resetSelection() {
    if (onReset) {
      onReset();
      return;
    }
    onChange?.([]);
  }

  return (
    <div className="relative max-w-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <details ref={detailsRef} className="group relative mt-2">
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
          {showResetButton ? (
            <button
              type="button"
              onClick={resetSelection}
              disabled={!selectedOptions.length}
              className="mb-2 w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Скинути
            </button>
          ) : null}
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
            <span>{allLabel}</span>
          </button>
          <div className="my-1 border-t border-line" />
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

export function PieChartCard({ title, data }: { title: string; data: ChartDatum[] }) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {data.length ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={96} label={(item) => item.name}>
                {data.map((_, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={tooltipFormatter} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState title="Немає даних для розподілу" />
      )}
    </article>
  );
}

export function EducationLevelPieGrid({ title, description, groups }: { title: string; description?: string; groups: PieChartGroup[] }) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-soft xl:col-span-2">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-xs leading-5 text-muted">{description}</p> : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {groups.map((group) => {
          const total = group.data.reduce((sum, item) => sum + item.value, 0);

          return (
          <div key={group.title} className="rounded-md border border-line bg-slate-50/60 p-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">{group.title}</h3>
              {group.description ? <p className="mt-1 text-xs leading-5 text-muted">{group.description}</p> : null}
            </div>
            {group.data.length ? (
              <>
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={group.data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={82} paddingAngle={1}>
                        {group.data.map((_, index) => (
                          <Cell key={index} fill={colors[index % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={tooltipFormatter} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-white px-2 py-1.5 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                    <span className="font-semibold text-slate-900">Разом</span>
                    <span className="font-bold text-slate-900">{formatNumber(total)}</span>
                  </div>
                  {group.data.map((item, index) => {
                    const percent = total > 0 ? (item.value / total) * 100 : 0;

                    return (
                      <div key={item.name} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                        <span className="truncate text-slate-700">{item.name}</span>
                        <span className="font-semibold text-slate-900">
                          {formatNumber(item.value)}
                          <span className="font-medium text-slate-500"> ({percent.toFixed(1)}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-md bg-white p-4">
                <EmptyState title="Немає даних" />
              </div>
            )}
          </div>
          );
        })}
      </div>
    </article>
  );
}
