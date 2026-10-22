import Image from "next/image";
import styles from "./PausedPage.module.css";

export function PausedPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Image src="/brand/eddash-logo.png" alt="EdDash" width={168} height={48} priority unoptimized className={styles.logo} />
        <span className={styles.headerNote}>Освіта як на дошці</span>
      </header>

      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="pause-title">
          <div className={styles.visual} aria-hidden="true">
            <div className={styles.orbit} />
            <div className={styles.orbitInner} />
            <div className={styles.pauseIcon}>
              <svg viewBox="0 0 40 40" fill="none"><rect x="10" y="8" width="7" height="24" rx="3" fill="currentColor" /><rect x="23" y="8" width="7" height="24" rx="3" fill="currentColor" /></svg>
            </div>
            <span className={styles.sparkOne}>+</span>
            <span className={styles.sparkTwo}>+</span>
            <span className={styles.dot} />
          </div>

          <p className={styles.eyebrow}><span /> Тимчасова перерва</p>
          <h1 id="pause-title" className={styles.title}>EdDash <span>на паузі</span></h1>
          <p className={styles.description}>Ми тимчасово призупинили роботу проєкту.<br className={styles.desktopBreak} /> Збережені дані чекають на наше повернення.</p>

          <div className={styles.preserved}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 7 3v5c0 4.3-3.1 7.8-7 10-3.9-2.2-7-5.7-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="m8.5 11.5 2.3 2.3 4.7-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>Дані збережено. До проєкту можна повернутися.</span>
          </div>

          <div className={styles.cardFooter}>
            <span className={styles.footerLine} />
            <p>Дякуємо за інтерес до EdDash!</p>
            <span className={styles.footerLine} />
          </div>
        </section>
      </main>

      <footer className={styles.footer}><span>EdDash</span><span>Відкриті дані. Зрозуміла освіта.</span></footer>
    </div>
  );
}
