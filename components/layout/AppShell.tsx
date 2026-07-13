import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/layout/Footer";
import { NavLink } from "@/components/layout/NavLink";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-eddash-bg">
      <header className="border-b border-line bg-white/95">
        <div className="h-1 bg-brand-600" />
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/brand/eddash-logo.png"
              alt="EdDash"
              width={168}
              height={48}
              priority
              unoptimized
              className="h-10 w-auto object-contain"
            />
          </Link>
          <nav className="flex flex-wrap items-center gap-1.5 text-sm font-medium sm:gap-2">
            <NavLink href="/dashboard">
              Дашборд
            </NavLink>
            <NavLink href="/institutions">
              Заклади освіти
            </NavLink>
            <NavLink href="/specialities">
              Галузі і спеціальності
            </NavLink>
            <NavLink href="/testing-center">
              Профорієнтація та тестування
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
