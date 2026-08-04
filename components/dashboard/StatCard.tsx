import { formatDate, formatNumber, formatSigned } from "@/lib/utils/format";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

export function StatCard({
  title,
  value,
  note,
  tone = "neutral",
  isLoading = false,
  helpText
}: {
  title: string;
  value: number | string;
  note?: string;
  tone?: "neutral" | "positive" | "negative";
  isLoading?: boolean;
  helpText?: string;
}) {
  const color = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-rose-700" : "text-ink";
  const displayValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start gap-2">
        <p className="text-sm font-medium text-muted">{title}</p>
        {helpText ? <InfoTooltip text={helpText} /> : null}
      </div>
      {isLoading ? (
        <div className="mt-3 h-7 w-28 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className={`mt-2 text-2xl font-bold ${color}`}>{displayValue}</p>
      )}
      {note ? <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p> : null}
    </div>
  );
}

function getSameDatePreviousYear(value: string): Date {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear() - 1, date.getUTCMonth(), date.getUTCDate()));
}

export function DeltaStatCard({
  delta,
  snapshotDate,
  year,
  helpText
}: {
  delta: number | null;
  snapshotDate?: string;
  year?: string;
  helpText?: string;
}) {
  const title = "Зміна до аналогічного зрізу";
  const previousDate = snapshotDate ? formatDate(getSameDatePreviousYear(snapshotDate)) : null;
  const previousYear = year ? String(Number(year) - 1) : null;

  if (delta === null) {
    return (
      <StatCard
        title={title}
        value="Немає даних"
        note={
          previousDate
            ? `Для поточних фільтрів немає даних на аналогічний зріз торік: ${previousDate}.`
            : previousYear
              ? `Для поточних фільтрів немає даних за попередній рік: ${previousYear}.`
              : "Для поточних фільтрів немає даних на аналогічний зріз торік."
        }
        helpText={helpText}
      />
    );
  }

  return (
    <StatCard
      title={title}
      value={formatSigned(delta)}
      tone={delta >= 0 ? "positive" : "negative"}
      note={
        previousDate
          ? `Порівняння з аналогічним зрізом торік: ${previousDate}.`
          : previousYear
            ? `Порівняння з попереднім роком: ${previousYear}.`
            : "Порівняння з аналогічним зрізом торік."
      }
      helpText={helpText}
    />
  );
}
