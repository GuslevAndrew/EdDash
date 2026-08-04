import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/layout/Footer";
import { NavLink } from "@/components/layout/NavLink";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-white/90 backdrop-blur">
        <div className="h-1 bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-500" />
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
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
          <nav className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 p-1 text-sm font-medium sm:gap-1">
            <NavLink href="/dashboard">
              Дашборд
            </NavLink>
            <NavLink href="/institutions">
              EdМапа
            </NavLink>
            <NavLink href="/specialities">
              Галузі і спеціальності
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
