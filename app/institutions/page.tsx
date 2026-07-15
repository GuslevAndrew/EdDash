import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { InstitutionsPageClient } from "@/components/institutions/InstitutionsPageClient";

export const metadata: Metadata = {
  title: "Заклади освіти",
  description:
    "Довідкова таблиця закладів вищої та фахової передвищої освіти України на основі відкритих даних ЄДЕБО.",
  alternates: {
    canonical: "/institutions"
  }
};

function InstitutionsShellFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-6 rounded-lg border border-line bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Інформація для вступників та дослідників.
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Заклади освіти</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
          Довідкова таблиця закладів вищої та фахової передвищої освіти на основі відкритих даних ЄДЕБО.
        </p>
      </section>
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm text-muted">Оновлюю дані, зачекайте декілька секунд...</p>
      </section>
    </div>
  );
}

export default function InstitutionsPage() {
  return (
    <AppShell>
      <Suspense fallback={<InstitutionsShellFallback />}>
        <InstitutionsPageClient />
      </Suspense>
    </AppShell>
  );
}
