import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Профорієнтація та тестування",
  description:
    "Майбутній розділ EdDash для профорієнтації, тестування та матеріалів, що допомагають краще зрозуміти освітній вибір.",
  alternates: {
    canonical: "/testing-center"
  }
};

export default function TestingCenterPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Інформаційний напрям</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">Профорієнтація та тестування</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            Розділ для матеріалів, які допомагають абітурієнтам краще зрозуміти власний вибір, підготуватися до
            вступних випробувань і пов'язати результати тестування з реальними освітніми можливостями.
          </p>
          <div className="mt-5 rounded-md border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-medium leading-6 text-brand-800">
            Цей блок зараз у розробці. Скоро на вас чекає гарний сюрприз!
          </div>
        </section>
      </div>
    </AppShell>
  );
}
