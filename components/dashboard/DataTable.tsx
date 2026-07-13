"use client";

import { Button } from "@/components/ui/Button";
import { formatDate, formatNumber } from "@/lib/utils/format";

export type TableRow = {
  id: number;
  institution: string;
  institutionType: string;
  region: string;
  field: string;
  speciality: string;
  educationLevel: string;
  entryBase: string;
  studyForm: string;
  snapshotDate: string;
  studentsCount: number;
};

const baseColumns = [
  ["institution", "Заклад освіти"],
  ["institutionType", "Рівень освіти"],
  ["region", "Регіон"],
  ["field", "Галузь знань"],
  ["speciality", "Спеціальність"],
  ["educationLevel", "Освітній ступінь"],
  ["entryBase", "Основа вступу"],
] as const;

export function DataTable({
  rows,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  dateColumnLabel = "Дата зрізу",
  countColumnLabel = "Контингент",
  showStudyForm = true
}: {
  rows: TableRow[];
  total: number;
  dateColumnLabel?: string;
  countColumnLabel?: string;
  showStudyForm?: boolean;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (sortBy: string, sortDir: "asc" | "desc") => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const columns = [
    ...baseColumns,
    ...(showStudyForm ? [["studyForm", "Форма навчання"] as const] : []),
    ["snapshotDate", dateColumnLabel] as const,
    ["studentsCount", countColumnLabel] as const
  ];

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Таблиця даних</h2>
          <p className="mt-1 text-sm text-muted">Знайдено записів: {formatNumber(total)}</p>
        </div>
        <div className="text-sm text-muted">
          Сторінка {page} з {pages}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1400px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-slate-50">
              {columns.map(([key, label]) => (
                <th key={key} className="px-3 py-3 font-semibold text-slate-700">
                  <button
                    className="inline-flex items-center gap-1 hover:text-brand-700"
                    onClick={() => onSortChange(key, sortBy === key && sortDir === "desc" ? "asc" : "desc")}
                  >
                    {label}
                    {sortBy === key ? <span>{sortDir === "desc" ? "↓" : "↑"}</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-3 font-medium text-ink">{row.institution}</td>
                <td className="px-3 py-3 text-slate-700">{row.institutionType}</td>
                <td className="px-3 py-3 text-slate-700">{row.region}</td>
                <td className="px-3 py-3 text-slate-700">{row.field}</td>
                <td className="px-3 py-3 text-slate-700">{row.speciality}</td>
                <td className="px-3 py-3 text-slate-700">{row.educationLevel}</td>
                <td className="px-3 py-3 text-slate-700">{row.entryBase}</td>
                {showStudyForm ? <td className="px-3 py-3 text-slate-700">{row.studyForm}</td> : null}
                <td className="px-3 py-3 text-slate-700">{dateColumnLabel === "Рік" ? row.snapshotDate : formatDate(row.snapshotDate)}</td>
                <td className="px-3 py-3 text-right font-semibold text-ink">{formatNumber(row.studentsCount)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted">
                  Дані не знайдено. Спробуйте змінити фільтри або завантажити демонстраційні дані.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <span className="font-medium">Показувати в таблиці</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Назад
          </Button>
          <Button variant="secondary" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            Вперед
          </Button>
        </div>
      </div>
    </section>
  );
}
