"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatDate, formatNumber } from "@/lib/utils/format";

type ImportRun = {
  id: number;
  type: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  recordsReceived: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorsCount: number;
  errorMessage: string | null;
};

type ImportState = {
  api: {
    ok: boolean;
    status: number | null;
    kind: string;
    durationMs: number;
    message: string;
  };
  lastSuccessful: ImportRun | null;
  history: ImportRun[];
};

export function ImportAdminClient() {
  const [state, setState] = useState<ImportState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/imports");
      const data = await response.json();
      setState(data);
    } catch {
      setActionMessage("Не вдалося отримати статус імпорту.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(path: string) {
    setActionMessage("Виконую запит...");
    try {
      const response = await fetch(path, { method: "POST" });
      const data = await response.json();
      setActionMessage(data.message ?? "Операцію завершено.");
      await load();
    } catch {
      setActionMessage("Операцію не вдалося виконати.");
    }
  }

  const last = state?.history[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ink">Імпорт даних</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Локальна технічна сторінка для перевірки ЄДЕБО та завантаження демонстраційного набору.
          Повний масовий імпорт не запускається автоматично.
        </p>
      </div>

      {actionMessage ? <div className="mb-4 rounded-md bg-brand-50 p-3 text-sm text-brand-700">{actionMessage}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard title="Статус API ЄДЕБО" value={loading ? "Перевіряю..." : state?.api.message ?? "Немає даних"} note={state?.api.status ? `HTTP ${state.api.status}, ${state.api.durationMs} мс, ${state.api.kind}` : undefined} />
        <InfoCard title="Останній імпорт" value={last ? formatDate(last.finishedAt ?? last.startedAt) : "Немає запусків"} note={last ? `Статус: ${translateStatus(last.status)}` : undefined} />
        <InfoCard title="Імпортовано записів" value={last ? formatNumber(last.recordsReceived) : "0"} note={last ? `Створено ${formatNumber(last.recordsCreated)}, оновлено ${formatNumber(last.recordsUpdated)}` : undefined} />
        <InfoCard title="Помилки" value={last ? formatNumber(last.errorsCount) : "0"} note={last?.errorMessage ?? "Критичних помилок не зафіксовано."} />
      </section>

      <section className="mt-6 rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-base font-semibold text-ink">Дії</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => runAction("/api/imports/test")}>Запустити тестовий імпорт</Button>
          <Button variant="secondary" onClick={() => runAction("/api/imports/demo")}>Завантажити демонстраційні дані</Button>
          <Button variant="secondary" onClick={load}>Оновити статус</Button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-base font-semibold text-ink">Останні запуски</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-line">
                <th className="px-3 py-3">Тип</th>
                <th className="px-3 py-3">Статус</th>
                <th className="px-3 py-3">Початок</th>
                <th className="px-3 py-3">Отримано</th>
                <th className="px-3 py-3">Створено</th>
                <th className="px-3 py-3">Оновлено</th>
                <th className="px-3 py-3">Помилки</th>
              </tr>
            </thead>
            <tbody>
              {state?.history.map((run) => (
                <tr key={run.id} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium">{run.type}</td>
                  <td className="px-3 py-3">{translateStatus(run.status)}</td>
                  <td className="px-3 py-3">{formatDate(run.startedAt)}</td>
                  <td className="px-3 py-3">{formatNumber(run.recordsReceived)}</td>
                  <td className="px-3 py-3">{formatNumber(run.recordsCreated)}</td>
                  <td className="px-3 py-3">{formatNumber(run.recordsUpdated)}</td>
                  <td className="px-3 py-3">{formatNumber(run.errorsCount)}</td>
                </tr>
              ))}
              {!state?.history.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted">
                    Історія імпортів поки порожня.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <p className="text-sm font-medium text-muted">{title}</p>
      <p className="mt-2 text-xl font-bold text-ink">{value}</p>
      {note ? <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p> : null}
    </div>
  );
}

function translateStatus(status: string) {
  if (status === "success") return "Успішно";
  if (status === "failed") return "Помилка";
  if (status === "running") return "Виконується";
  return status;
}
