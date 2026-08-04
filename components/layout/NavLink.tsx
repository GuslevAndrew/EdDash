"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      className={clsx(
        "rounded-md px-3 py-2 transition",
        isActive
          ? "bg-white text-brand-800 shadow-sm ring-1 ring-brand-100"
          : "text-slate-600 hover:bg-white/80 hover:text-ink hover:shadow-sm"
      )}
      href={href}
    >
      {children}
    </Link>
  );
}
