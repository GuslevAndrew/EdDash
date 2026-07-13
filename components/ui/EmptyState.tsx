export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-card border border-dashed border-line bg-white p-6 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-muted">{description}</p> : null}
    </div>
  );
}
