"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SETTINGS_ITEM, isNavActive } from "./nav-items";

/** Compact top navigation shown on small screens (md:hidden). */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-surface md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            V
          </span>
          <span className="font-semibold text-ink">Vikarhjelp</span>
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm font-medium text-muted">
            Logg ut
          </button>
        </form>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {[...NAV_ITEMS, SETTINGS_ITEM].map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active ? "bg-brand-50 text-brand-700" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
