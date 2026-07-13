import { AppShell } from "@/components/layout/AppShell";

const consultingBlocks = [
  "пояснення вибору закладу освіти та спеціальності",
  "порівняння освітніх траєкторій",
  "підготовка до вступної кампанії",
  "аналітичні довідки для родин і консультантів",
  "питання до даних EdDash і їх інтерпретації"
];

export default function ConsultingPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Практичний напрям</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">Консультування</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            Розділ для майбутніх консультаційних матеріалів на основі даних EdDash. Його можна використовувати як простір
            для пояснень, рекомендацій, сценаріїв вибору та відповідей на типові питання вступників і батьків.
          </p>
        </section>

        <section className="mt-6 rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Майбутнє наповнення</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {consultingBlocks.map((item) => (
              <div key={item} className="rounded-md border border-line bg-slate-50 p-4 text-sm font-medium text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
