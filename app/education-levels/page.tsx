import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";

type EducationLevelItem = {
  title: string;
  note: string;
  degree?: string;
};

type EducationLevelGroup = {
  group: string;
  levels: EducationLevelItem[];
};

const educationLevels: EducationLevelGroup[] = [
  {
    group: "Дошкільна освіта",
    levels: [
      {
        title: "Дошкільна освіта",
        note: "Перший освітній рівень у загальній структурі освіти. Закон про дошкільну освіту окремо описує базові етапи: ранній вік і дошкільний вік."
      }
    ]
  },
  {
    group: "Повна загальна середня освіта",
    levels: [
      {
        title: "Початкова освіта",
        note: "Перший рівень повної загальної середньої освіти. Зазвичай здобувається протягом чотирьох років."
      },
      {
        title: "Базова середня освіта",
        note: "Другий рівень повної загальної середньої освіти. Зазвичай здобувається протягом п'яти років."
      },
      {
        title: "Профільна середня освіта",
        note: "Третій рівень повної загальної середньої освіти. Зазвичай здобувається протягом трьох років і може мати академічне або професійне спрямування."
      }
    ]
  },
  {
    group: "Професійна освіта",
    levels: [
      {
        title: "Професійна освіта",
        note: "Окремий рівень освіти після змін 2025 року. У законодавстві старі терміни професійно-технічної освіти мають бути приведені до терміна професійна освіта."
      }
    ]
  },
  {
    group: "Фахова передвища освіта",
    levels: [
      {
        title: "Фахова передвища освіта",
        note: "Окремий рівень освіти між профільною середньою/професійною освітою та вищою освітою. Ступінь цього рівня - фаховий молодший бакалавр."
      }
    ]
  },
  {
    group: "Вища освіта",
    levels: [
      {
        title: "Початковий рівень (короткий цикл) вищої освіти",
        degree: "Молодший бакалавр",
        note: "Рівень вищої освіти для здобуття ступеня молодшого бакалавра."
      },
      {
        title: "Перший (бакалаврський) рівень вищої освіти",
        degree: "Бакалавр",
        note: "Рівень вищої освіти, що передбачає здатність розв'язувати складні спеціалізовані задачі у певній галузі професійної діяльності."
      },
      {
        title: "Другий (магістерський) рівень вищої освіти",
        degree: "Магістр",
        note: "Рівень вищої освіти для задач дослідницького та/або інноваційного характеру. Магістерські програми можуть бути освітньо-професійними або освітньо-науковими."
      },
      {
        title: "Третій (освітньо-науковий/освітньо-творчий) рівень вищої освіти",
        degree: "Доктор філософії (PhD) / доктор мистецтва",
        note: "Рівень для підготовки дослідників або митців найвищої освітньої траєкторії. Доктор філософії (PhD) здобувається на основі ступеня магістра."
      }
    ]
  }
];

const educationComponents = [
  "дошкільна освіта",
  "повна загальна середня освіта",
  "позашкільна освіта",
  "спеціалізована освіта",
  "професійна освіта",
  "фахова передвища освіта",
  "вища освіта",
  "освіта дорослих, у тому числі післядипломна освіта"
];

const sourceLinks = [
  {
    title: "Закон України «Про освіту»",
    href: "https://zakon.rada.gov.ua/go/2145-19",
    detail: "базовий перелік складників і рівнів освіти"
  },
  {
    title: "Закон України «Про дошкільну освіту»",
    href: "https://zakon.rada.gov.ua/go/3788-20",
    detail: "базові етапи дошкільної освіти"
  },
  {
    title: "Закон України «Про повну загальну середню освіту»",
    href: "https://zakon.rada.gov.ua/go/463-20",
    detail: "початкова, базова середня і профільна середня освіта"
  },
  {
    title: "Закон України «Про професійну освіту»",
    href: "https://zakon.rada.gov.ua/go/4574-20",
    detail: "оновлена термінологія професійної освіти"
  },
  {
    title: "Закон України «Про фахову передвищу освіту»",
    href: "https://zakon.rada.gov.ua/go/2745-19",
    detail: "рівень фахової передвищої освіти і ступінь фахового молодшого бакалавра"
  },
  {
    title: "Закон України «Про вищу освіту»",
    href: "https://zakon.rada.gov.ua/go/1556-18",
    detail: "рівні та ступені вищої освіти"
  }
];

export default function EducationLevelsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Довідник</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">Рівні освіти</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            Статична довідкова сторінка EdDash про структуру освіти в Україні. Вона спирається на Закон України
            «Про освіту» та спеціальні закони, які регулюють окремі рівні освіти.
          </p>
          <div className="mt-4 rounded-md bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Інформація має довідковий характер і не є юридичною консультацією. Для офіційного застосування завжди
            перевіряйте чинну редакцію законів на zakon.rada.gov.ua.
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Складники системи освіти</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Закон «Про освіту» розрізняє складники системи освіти і власне рівні освіти. Не кожен складник є окремим
            рівнем, але всі вони важливі для розуміння освітньої системи.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {educationComponents.map((component) => (
              <div key={component} className="rounded-md border border-line bg-slate-50 p-4 text-sm font-medium text-slate-700">
                {component}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 space-y-5">
          {educationLevels.map((group) => (
            <article key={group.group} className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <h2 className="text-xl font-semibold text-ink">{group.group}</h2>
              <div className="mt-4 grid gap-3">
                {group.levels.map((level) => (
                  <div key={level.title} className="rounded-md border border-line bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-ink">{level.title}</h3>
                      {level.degree ? (
                        <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                          Ступінь: {level.degree}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{level.note}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Джерела</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {sourceLinks.map((source) => (
              <Link
                key={source.href}
                href={source.href}
                className="rounded-md border border-line bg-slate-50 p-4 hover:border-brand-500 hover:bg-brand-50"
              >
                <span className="block text-sm font-semibold text-brand-700">{source.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">{source.detail}</span>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">
            Першу редакцію сторінки звірено з чинними редакціями джерел станом на 18.06.2026.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
