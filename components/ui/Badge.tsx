import { clsx } from "clsx";

type BadgeTone = "active" | "warning" | "error" | "info" | "neutral";

const toneClassName: Record<BadgeTone, string> = {
  active: "bg-green-50 text-green-800 ring-green-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  error: "bg-red-50 text-red-800 ring-red-200",
  info: "bg-brand-50 text-brand-700 ring-brand-100",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200"
};

export function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={clsx("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", toneClassName[tone], className)}>
      {children}
    </span>
  );
}
