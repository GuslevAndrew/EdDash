import { AppShell } from "@/components/layout/AppShell";

const futureBlocks = [
  "відкриті освітні дані",
  "державні електронні системи в освіті",
  "цифрові сервіси для вступників",
  "якість і повнота даних",
  "показники цифровізації закладів освіти"
];

export default function DigitalEducationPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Аналітичний напрям</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">Цифра в освіті</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            Тут буде окрема закладка EdDash про цифрові дані та сервіси в освіті. Поки це базова сторінка-напрям,
            яку завтра можна наповнити конкретними показниками, джерелами та поясненнями.
          </p>
        </section>

        <section className="mt-6 rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Що можна розмістити в цьому розділі</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {futureBlocks.map((item) => (
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
