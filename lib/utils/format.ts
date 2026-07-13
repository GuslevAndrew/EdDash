export function formatNumber(value: number): string {
  return new Intl.NumberFormat("uk-UA").format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "Немає даних";
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function formatSigned(value: number): string {
  const formatted = formatNumber(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return "0";
}
