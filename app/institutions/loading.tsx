import { AppShell } from "@/components/layout/AppShell";

export default function InstitutionsLoading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-lg border border-line bg-white p-6 shadow-soft">
          <p className="mb-4 rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-muted">
            Оновлюю дані, зачекайте декілька секунд...
          </p>
          <div className="h-4 w-72 animate-pulse rounded bg-brand-100" />
          <div className="mt-4 h-9 w-64 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 max-w-4xl space-y-2">
            <div className="h-4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="grid gap-5 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index}>
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-10 animate-pulse rounded-md bg-slate-100" />
              </div>
            ))}
            <div className="md:col-span-2">
              <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-10 animate-pulse rounded-md bg-slate-100" />
            </div>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index + 2}>
                <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-10 animate-pulse rounded-md bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <div className="h-10 w-28 animate-pulse rounded-md bg-brand-100" />
            <div className="h-10 w-24 animate-pulse rounded-md bg-slate-100" />
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="h-6 w-44 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-9 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
