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

        <section className="mb-6 overflow-hidden rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-brand-50 p-5 shadow-soft ring-1 ring-white/80 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Для закладів освіти</p>
              <h2 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Додати освітню програму</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Бажаєте розповісти про свою освітню програму більше, ніж видно у відкритих даних? EdDash дасть змогу
                показати переваги програми, умови вступу, можливості для студентів, контакти відповідальних осіб і
                перейти від сухої назви в таблиці до зрозумілої сторінки для вступників та їхніх батьків.
              </p>
            </div>

            <details className="group shrink-0">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-3 rounded-full border border-brand-600 bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-dropdown transition hover:-translate-y-0.5 hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-2xl leading-none text-brand-700 transition group-open:rotate-45">
                  +
                </span>
                <span>Додати програму</span>
              </summary>
              <div className="mt-3 rounded-lg border border-brand-100 bg-white/90 p-4 text-sm leading-6 text-slate-700 shadow-sm">
                <p className="font-semibold text-ink">Незабаром тут з'явиться форма додавання.</p>
                <p className="mt-1">
                  Поки готуємо цей інструмент, можна написати нам на{" "}
                  <a className="font-semibold text-brand-700 hover:text-brand-800" href="mailto:contact@eddash.info">
                    contact@eddash.info
                  </a>
                  .
                </p>
              </div>
            </details>
          </div>
        </section>

        <EducationProgramsClient />
      </div>
    </AppShell>
  );
}
