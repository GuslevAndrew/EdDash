import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { NavLink } from "@/components/layout/NavLink";

const navigation = [
  { href: "/dashboard", label: "Дашборд" },
  { href: "/institutions", label: "EdМапа" },
  { href: "/specialities", label: "Галузі і спеціальності" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-white/90 backdrop-blur">
        <div className="h-1 bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-500" />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex min-w-0 items-center">
            <Image
              src="/brand/eddash-logo.png"
              alt="EdDash"
              width={168}
              height={48}
              priority
              unoptimized
              className="h-9 w-auto object-contain sm:h-10"
            />
          </Link>

          <nav className="hidden flex-wrap items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50/80 p-1 text-sm font-medium md:flex">
            {navigation.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <MobileNav items={navigation} />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
