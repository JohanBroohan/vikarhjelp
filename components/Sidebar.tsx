"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SETTINGS_ITEM, isNavActive } from "./nav-items";

const STORAGE_KEY = "vh:sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);

  // Restore the collapsed preference (kept across reloads, e.g. on the TV) and
  // read the current theme (set before paint by the root layout script).
  useEffect(() => {
    const restore = () => {
      try {
        setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
      } catch {
        /* ignore */
      }
      setDark(document.documentElement.classList.contains("dark"));
    };
    restore();
  }, []);

  function toggleTheme() {
    setDark((d) => {
      const next = !d;
      try {
        localStorage.setItem("vh:theme", next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Brand */}
      <div className={`flex items-center py-5 ${collapsed ? "justify-center px-0" : "gap-2.5 px-5"}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          V
        </div>
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight text-ink">
            Vikarhjelp
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-lg py-2 text-sm font-medium transition ${
                collapsed ? "justify-center px-0" : "gap-3 px-3"
              } ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              <svg
                className="h-[18px] w-[18px] shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: collapse toggle, account, sign out */}
      <div className="space-y-1 border-t border-line p-3">
        <button
          onClick={toggle}
          title={collapsed ? "Vis meny" : "Skjul meny"}
          className={`flex w-full items-center rounded-lg py-2 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink ${
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          }`}
        >
          <svg
            className={`h-[18px] w-[18px] shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {!collapsed && "Skjul meny"}
        </button>

        <button
          onClick={toggleTheme}
          title={collapsed ? (dark ? "Lyst tema" : "Mørkt tema") : undefined}
          className={`flex w-full items-center rounded-lg py-2 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink ${
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          }`}
        >
          {dark ? (
            <svg
              className="h-[18px] w-[18px] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg
              className="h-[18px] w-[18px] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          {!collapsed && (dark ? "Lyst tema" : "Mørkt tema")}
        </button>

        <Link
          href={SETTINGS_ITEM.href}
          title={collapsed ? SETTINGS_ITEM.label : undefined}
          className={`flex w-full items-center rounded-lg py-2 text-sm font-medium transition ${
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          } ${
            isNavActive(pathname, SETTINGS_ITEM.href)
              ? "bg-brand-50 text-brand-700"
              : "text-muted hover:bg-canvas hover:text-ink"
          }`}
        >
          <svg
            className="h-[18px] w-[18px] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={SETTINGS_ITEM.icon} />
          </svg>
          {!collapsed && SETTINGS_ITEM.label}
        </Link>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            title="Logg ut"
            className={`flex w-full items-center rounded-lg py-2 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink ${
              collapsed ? "justify-center px-0" : "gap-3 px-3"
            }`}
          >
            <svg
              className="h-[18px] w-[18px] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            </svg>
            {!collapsed && "Logg ut"}
          </button>
        </form>
      </div>
    </aside>
  );
}
