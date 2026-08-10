"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useAutoCloseDetails } from "@/components/ui/useAutoCloseDetails";

type MobileNavItem = {
  href: string;
  label: string;
  featured?: boolean;
};

export function MobileNav({ items }: { items: MobileNavItem[] }) {
  const pathname = usePathname();
  const detailsRef = useAutoCloseDetails();

  return (
    <details ref={detailsRef} className="relative md:hidden">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 shadow-sm transition hover:border-brand-200 hover:bg-brand-100">
        <span className="flex h-4 w-4 flex-col justify-center gap-1" aria-hidden="true">
          <span className="h-0.5 rounded-full bg-current" />
          <span className="h-0.5 rounded-full bg-current" />
          <span className="h-0.5 rounded-full bg-current" />
        </span>
        Меню
      </summary>
      <div className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-line bg-white p-2 shadow-dropdown ring-1 ring-slate-900/5">
        <nav className="grid gap-1 text-sm font-medium">
          {items.map((item) => {
            const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "rounded-md px-3 py-2.5 transition",
                  item.featured
                    ? isActive
                      ? "bg-brand-700 text-white ring-1 ring-brand-700"
                      : "bg-brand-600 text-white ring-1 ring-brand-500 hover:bg-brand-700"
                    : isActive
                      ? "bg-brand-50 text-brand-800 ring-1 ring-brand-100"
                      : "text-slate-700 hover:bg-slate-50 hover:text-ink"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </details>
  );
}
