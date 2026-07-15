import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { getLastSuccessfulImport } from "@/lib/dashboard/queries";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "EdDash — освіта як на дошці",
  description:
    "EdDash допомагає шукати, перевіряти та аналізувати відкриті офіційні дані про освіту після школи в Україні.",
  alternates: {
    canonical: "/"
  }
};

const primaryScenarios = [
  {
    title: "Знайти заклад освіти",
    text: "Перегляньте університети й коледжі за регіоном, рівнем закладу, містом, статусом у ЄДЕБО та контактами.",
    href: "/institutions",
    action: "Переглянути заклади"
  },
  {
    title: "Розібратися зі спеціальностями",
    text: "Подивіться, до якої галузі належить спеціальність, як вона позначається в новому переліку і для яких рівнів доступна.",
    href: "/specialities",
    action: "Знайти спеціальність"
  },
  {
    title: "Порівняти дані",
    text: "Аналізуйте контингент, зарахування і випуск за роками, регіонами, закладами, галузями та спеціальностями.",
    href: "/dashboard",
    action: "Відкрити дашборд"
  }
];

export default async function HomePage() {
  const lastImport = await getLastSuccessfulImport();

  return (
    <AppShell>
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Сервіс використовує відкриті офіційні дані</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-ink sm:text-5xl">
              Освіта як на дошці
            </h1>
            <p className="mt-5 max-w-2xl text-xl font-semibold leading-8 text-slate-800">
              Пошук, перевірка та аналіз освіти в одному дашборді.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              EdDash допомагає абітурієнтам, батькам, консультантам і фахівцям швидко розібратися в даних про
              заклади вищої та фахової передвищої освіти, спеціальності, регіони, зарахування, випуск і динаміку
              контингенту.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link className="rounded-md bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700" href="/dashboard">
                Почати
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-[18px] border border-line bg-slate-50 p-6 shadow-soft">
              <Image
                src="/brand/eddash-logo.png"
                alt="EdDash"
                width={420}
                height={120}
                priority
                unoptimized
                className="h-auto w-full object-contain"
              />
              <div className="mt-8 grid gap-3 text-sm leading-6 text-slate-700">
                <div className="rounded-lg border border-line bg-white p-4">
                  <p className="font-semibold text-ink">Останнє успішне оновлення</p>
                  <p className="mt-1 text-slate-600">{formatDate(lastImport?.finishedAt)}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  Дані мають інформаційно-аналітичний характер. EdDash не є офіційним сервісом ЄДЕБО.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Освіта без хаосу</p>
          <h2 className="mt-3 text-2xl font-bold text-ink">Що можна зробити в EdDash</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Платформа збирає відкриті дані в зрозумілі сценарії: знайти заклад, перевірити спеціальність, подивитися
            динаміку й порівняти варіанти перед вступом або аналітичною роботою.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {primaryScenarios.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-[14px] border border-line bg-white p-5 shadow-sm transition hover:border-brand-100 hover:shadow-soft"
            >
              <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-brand-700 group-hover:text-brand-800">{item.action}</span>
            </Link>
          ))}
        </div>
      </section>

    </AppShell>
  );
}
