"use client";

import { useEffect, useMemo, useState } from "react";
import { formatNumber } from "@/lib/utils/format";

const defaultPageSize = 25;
const maxPageSize = 250;

type SortKey = "institution" | "parent" | "region" | "students" | "foundationYear" | "ownership";
type SortDirection = "asc" | "desc";

type InstitutionTableRow = {
  id: number;
  rowNumber: number;
  name: string;
  shortName: string | null;
  website: string | null;
  blockedAt: string | null;
  parent: {
    name: string;
    website: string | null;
    blockedAt: string | null;
  } | null;
  region: string;
  settlement: string | null;
  students: number | null;
  foundationYear: string | null;
  ownership: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

type InstitutionTableResponse = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  rows: InstitutionTableRow[];
};

type InstitutionsTableProps = {
  initialQuery: string;
  initialSort: SortKey;
  initialDirection: SortDirection;
  initialPageSize: number;
};

function displayLocation(regionName: string, settlement: string | null): string {
  const normalizedSettlement = settlement?.trim().toLowerCase();
  if (regionName === "м. Київ" && normalizedSettlement === "київ") return regionName;
  if (settlement) return `${regionName}, ${settlement}`;
  return regionName;
}

function makeTableQuery(baseQuery: string, sort: SortKey, direction: SortDirection, pageSize: number): string {
  const params = new URLSearchParams(baseQuery);
  params.delete("page");
  params.set("sort", sort);
  params.set("direction", direction);
  params.set("pageSize", String(pageSize));
  return params.toString();
}

function nextSortDirection(sort: SortKey, currentSort: SortKey, currentDirection: SortDirection): SortDirection {
  return sort === currentSort && currentDirection === "asc" ? "desc" : "asc";
}

export function InstitutionsTable({
  initialQuery,
  initialSort,
  initialDirection,
  initialPageSize
}: InstitutionsTableProps) {
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [direction, setDirection] = useState<SortDirection>(initialDirection);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [data, setData] = useState<InstitutionTableResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(
    () => makeTableQuery(initialQuery, sort, direction, pageSize),
    [direction, initialQuery, pageSize, sort]
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError("");

    fetch(`/api/institutions/table?${query}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Table request failed");
        return response.json() as Promise<InstitutionTableResponse>;
      })
      .then((nextData) => setData(nextData))
      .catch((tableError) => {
        if (tableError instanceof DOMException && tableError.name === "AbortError") return;
        setError("Не вдалося завантажити таблицю закладів. Спробуйте оновити сторінку або змінити фільтри.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    if (typeof window !== "undefined") {
      const nextUrl = query ? `/institutions?${query}` : "/institutions";
      window.history.replaceState(null, "", nextUrl);
    }

    return () => controller.abort();
  }, [query]);

  function changeSort(nextSort: SortKey) {
    setDirection(nextSortDirection(nextSort, sort, direction));
    setSort(nextSort);
    setPageSize(defaultPageSize);
  }

  function showMore() {
    setPageSize((current) => Math.min(current + defaultPageSize, data?.total ?? maxPageSize, maxPageSize));
  }

  const canShowMore = Boolean(data && data.pageSize < data.total && data.pageSize < maxPageSize);

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Таблиця закладів</h2>
          <p className="mt-1 text-sm text-muted">
            {data ? `Знайдено: ${formatNumber(data.total)}` : "Оновлюю дані, зачекайте декілька секунд..."}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Натискайте на назву стовпчика, щоб відсортувати таблицю за відповідною ознакою. За замовчуванням
            заклади освіти розташовані в алфавітному порядку з урахуванням обраних фільтрів.
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-[1220px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-slate-50">
              <th className="w-10 px-2 py-3 text-center font-semibold text-slate-700">№</th>
              <SortableHeader label="Заклад освіти" sort="institution" currentSort={sort} currentDirection={direction} onSort={changeSort} />
              <SortableHeader label="Головний заклад" sort="parent" currentSort={sort} currentDirection={direction} onSort={changeSort} />
              <SortableHeader label="Регіон" sort="region" currentSort={sort} currentDirection={direction} onSort={changeSort} />
              <SortableHeader label="Контингент" sort="students" currentSort={sort} currentDirection={direction} onSort={changeSort} align="right" />
              <SortableHeader label="Рік заснування" sort="foundationYear" currentSort={sort} currentDirection={direction} onSort={changeSort} />
              <SortableHeader label="Форма власності" sort="ownership" currentSort={sort} currentDirection={direction} onSort={changeSort} />
              <th className="px-3 py-3 font-semibold text-slate-700">Контакти</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <LoadingRows /> : null}
            {error && !isLoading ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-rose-700">
                  {error}
                </td>
              </tr>
            ) : null}
            {!isLoading && !error && data?.rows.map((institution) => (
              <InstitutionRow key={institution.id} institution={institution} />
            ))}
            {!isLoading && !error && data && !data.rows.length ? (
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
          <button
            type="button"
            onClick={showMore}
            disabled={isLoading}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            Показати ще
          </button>
        ) : null}
      </div>
    </section>
  );
}

function InstitutionRow({ institution }: { institution: InstitutionTableRow }) {
  const isBlocked = Boolean(institution.blockedAt);
  const parentHref = institution.parent?.website && !institution.parent.blockedAt ? institution.parent.website : null;
  const canLinkToParent = !institution.website && Boolean(parentHref);

  return (
    <tr className={`border-b ${isBlocked ? "border-rose-100 bg-rose-50" : "border-slate-100"}`}>
      <td className="px-2 py-3 text-center align-top text-sm font-medium text-slate-500">{formatNumber(institution.rowNumber)}</td>
      <td className="px-3 py-3 align-top">
        <div className="max-w-sm">
          {institution.website && !isBlocked ? (
            <a className="font-semibold text-brand-700 hover:text-brand-800" href={institution.website}>
              {institution.name}
            </a>
          ) : (
            <span className={`font-semibold ${isBlocked ? "text-rose-800" : "text-ink"}`}>{institution.name}</span>
          )}
          {institution.shortName ? <p className="mt-1 text-xs text-slate-500">{institution.shortName}</p> : null}
          {isBlocked ? (
            <p className="mt-1 text-xs font-semibold text-rose-700">
              Заблоковано в ЄДЕБО: {institution.blockedAt}
            </p>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-3 align-top text-slate-700">
        {institution.parent ? (
          canLinkToParent ? (
            <a className="font-medium text-brand-700 hover:text-brand-800" href={parentHref as string}>
              {institution.parent.name}
            </a>
          ) : (
            institution.parent.name
          )
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-3 align-top text-slate-700">{displayLocation(institution.region, institution.settlement)}</td>
      <td className="px-3 py-3 text-right align-top font-semibold text-ink">
        {institution.students === null ? "—" : formatNumber(institution.students)}
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
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="border-b border-slate-100">
          <td colSpan={8} className="px-3 py-3">
            <div className="h-6 animate-pulse rounded bg-slate-100" />
          </td>
        </tr>
      ))}
    </>
  );
}

function SortableHeader({
  label,
  sort,
  currentSort,
  currentDirection,
  onSort,
  align = "left"
}: {
  label: string;
  sort: SortKey;
  currentSort: SortKey;
  currentDirection: SortDirection;
  onSort: (sort: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = sort === currentSort;
  const arrow = isActive ? (currentDirection === "asc" ? "↑" : "↓") : "↕";

  return (
    <th className={`px-3 py-3 font-semibold text-slate-700 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sort)}
        className={`inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-white ${
          align === "right" ? "justify-end" : "justify-start"
        } ${isActive ? "text-brand-700" : "text-slate-700"}`}
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-xs">
          {arrow}
        </span>
      </button>
    </th>
  );
}
