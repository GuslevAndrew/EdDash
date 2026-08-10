import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { specialityCatalogSource } from "@/lib/specialities/catalog";
import { specializationsBySpecialityCode } from "@/lib/specialities/specializations";

export const metadata: Metadata = {
  title: "Галузі і спеціальності",
  description:
    "Довідник галузей знань і спеціальностей для вступників: коди, назви та доступність для рівнів підготовки.",
  alternates: {
    canonical: "/specialities"
  }
};

type LevelKey = keyof (typeof specialityCatalogSource.specialities)[number]["levels"];

const levelLabels: Array<{ key: LevelKey; label: string }> = [
  { key: "professionalPreHigher", label: "Фаховий молодший бакалавр" },
  { key: "bachelor", label: "Бакалавр" },
  { key: "master", label: "Магістр" },
  { key: "phd", label: "Доктор філософії (PhD)" }
];

export default function SpecialitiesPage() {
  const { fields, specialities } = specialityCatalogSource;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-lg border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Інформація для вступників</p>
          <h1 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">Галузі знань і спеціальності</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            Це довідкова таблиця чинного переліку галузей знань і спеціальностей, за якими здійснюється
            підготовка здобувачів вищої та фахової передвищої освіти. Вона допомагає швидко побачити,
            до якої галузі належить спеціальність і на яких рівнях освіти передбачена підготовка.
          </p>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            У таблиці ФМБ означає рівень “фаховий молодший бакалавр”.
          </p>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryCard title="Галузей знань" value={fields.length} />
          <SummaryCard title="Спеціальностей" value={specialities.length} />
          <SummaryCard
            title="Доступні для ФМБ"
            value={specialities.filter((item) => item.levels.professionalPreHigher).length}
          />
          <SummaryCard
            title="Доступні для бакалавра"
            value={specialities.filter((item) => item.levels.bachelor).length}
          />
          <SummaryCard
            title="Доступні для магістра"
            value={specialities.filter((item) => item.levels.master).length}
          />
          <SummaryCard
            title="Доступні для доктора філософії (PhD)"
            value={specialities.filter((item) => item.levels.phd).length}
          />
        </section>

        <section className="mb-6 rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Галузі знань</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <a key={field.code} href={`#field-mobile-${field.code}`} className="rounded-md border border-line bg-slate-50 p-4 hover:border-brand-500 hover:bg-brand-50 md:hidden">
                <span className="text-lg font-bold text-brand-700">{field.code}</span>
                <span className="ml-3 text-sm font-medium text-ink">{field.name}</span>
              </a>
            ))}
            {fields.map((field) => (
              <a key={field.code} href={`#field-desktop-${field.code}`} className="hidden rounded-md border border-line bg-slate-50 p-4 hover:border-brand-500 hover:bg-brand-50 md:block">
                <span className="text-lg font-bold text-brand-700">{field.code}</span>
                <span className="ml-3 text-sm font-medium text-ink">{field.name}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Повна таблиця спеціальностей</h2>
            </div>
            <p className="text-sm text-muted">Позначка “+” означає, що підготовка передбачена на відповідному рівні.</p>
          </div>

          <div className="mt-5 space-y-4 md:hidden">
            {fields.map((field) => {
              const rows = specialities.filter((item) => item.fieldCode === field.code);

              return (
                <section key={field.code} id={`field-mobile-${field.code}`} className="scroll-mt-24 rounded-lg border border-line bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="rounded-md bg-brand-600 px-2.5 py-1 text-sm font-bold text-white">{field.code}</span>
                    <h3 className="font-semibold leading-5 text-ink">{field.name}</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {rows.map((item) => (
                      <article key={item.code} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-start gap-3">
                          <span className="rounded-md bg-brand-50 px-2 py-1 text-sm font-bold text-brand-700">{item.code}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold leading-5 text-ink">{item.name}</p>
                            <LevelBadges levels={item.levels} />
                            <SpecialityNameCell code={item.code} name="" />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-5 hidden max-h-[75vh] overflow-auto md:block">
            <table className="min-w-[920px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 font-semibold text-slate-700 shadow-sm">Галузь знань</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 font-semibold text-slate-700 shadow-sm">Код</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 font-semibold text-slate-700 shadow-sm">Спеціальність</th>
                  {levelLabels.map((level) => (
                    <th key={level.key} className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-center font-semibold text-slate-700 shadow-sm">
                      {level.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => {
                  const rows = specialities.filter((item) => item.fieldCode === field.code);
                  return rows.map((item, index) => (
                    <tr key={item.code} id={index === 0 ? `field-desktop-${field.code}` : undefined} className="scroll-mt-24 border-b border-slate-100">
                      <td className="px-3 py-3 align-top">
                        {index === 0 ? (
                          <div>
                            <p className="font-bold text-brand-700">{field.code}</p>
                            <p className="mt-1 max-w-64 font-medium text-ink">{field.name}</p>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-top font-semibold text-ink">{item.code}</td>
                      <td className="px-3 py-3 align-top text-slate-700">
                        <SpecialityNameCell code={item.code} name={item.name} />
                      </td>
                      {levelLabels.map((level) => (
                        <td key={level.key} className="px-3 py-3 text-center align-top">
                          {item.levels[level.key] ? <span className="font-bold text-emerald-700">+</span> : <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SummaryCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <p className="text-sm font-medium text-muted">{title}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function SpecialityNameCell({ code, name }: { code: string; name: string }) {
  const specializations = specializationsBySpecialityCode[code as keyof typeof specializationsBySpecialityCode] ?? [];

  return (
    <div>
      {name ? <span>{name}</span> : null}
      {specializations.length ? (
        <details className="group mt-2 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white [&::-webkit-details-marker]:hidden">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm transition-transform group-open:rotate-90">
              ›
            </span>
            <span>Спеціалізації</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 shadow-sm">{specializations.length}</span>
          </summary>
          <ul className="space-y-1 border-t border-slate-200 bg-white px-3 py-2">
            {specializations.map((specialization) => (
              <li key={`${specialization.code}-${specialization.name}`} className="grid grid-cols-[76px_1fr] gap-2 text-xs leading-5 text-slate-700">
                <span className="font-semibold text-brand-700">{specialization.code}</span>
                <span>{specialization.name}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function LevelBadges({ levels }: { levels: (typeof specialityCatalogSource.specialities)[number]["levels"] }) {
  const availableLevels = levelLabels.filter((level) => levels[level.key]);

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {availableLevels.map((level) => (
        <span key={level.key} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          {level.label}
        </span>
      ))}
      {!availableLevels.length ? <span className="text-xs text-muted">Рівні не позначені</span> : null}
    </div>
  );
}
