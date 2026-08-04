export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-line bg-slate-50/80 p-6 text-center">
      <div className="mb-3 h-1.5 w-10 rounded-full bg-brand-200" />
      <p className="font-semibold text-ink">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-muted">{description}</p> : null}
    </div>
  );
}
