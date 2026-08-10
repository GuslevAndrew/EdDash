"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export function NavLink({
  href,
  children,
  featured = false
}: {
  href: string;
  children: React.ReactNode;
  featured?: boolean;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      className={clsx(
        "rounded-md px-3 py-2 transition",
        featured
          ? isActive
            ? "bg-brand-700 text-white shadow-sm ring-1 ring-brand-700"
            : "bg-brand-600 text-white shadow-sm ring-1 ring-brand-500 hover:bg-brand-700"
          : isActive
            ? "bg-white text-brand-800 shadow-sm ring-1 ring-brand-100"
            : "text-slate-600 hover:bg-white/80 hover:text-ink hover:shadow-sm"
      )}
      href={href}
    >
      {children}
    </Link>
  );
}
