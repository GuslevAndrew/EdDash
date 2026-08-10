import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { EducationProgramsClient } from "@/components/education-programs/EducationProgramsClient";

export const metadata: Metadata = {
  title: "Освітня програма",
  description:
    "Майбутній розділ EdDash для пошуку, порівняння та аналізу освітніх програм на основі відкритих освітніх даних.",
  alternates: {
    canonical: "/education-programs"
  }
};

export default function EducationProgramsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-lg border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Майбутній ключовий розділ</p>
          <h1 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">Освітня програма</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            Тут зібрано реальні назви освітніх програм, прив'язані до регіонів, закладів освіти, рівнів закладів,
            галузей знань, спеціальностей і спеціалізацій. Цей розділ стане основою для пошуку та порівняння
            освітніх програм в EdDash.
          </p>
        </section>

        <EducationProgramsClient />
      </div>
    </AppShell>
  );
}
