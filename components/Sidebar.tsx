"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Moon, Sun, LogOut } from "lucide-react";
import { NAV_ITEMS, SETTINGS_ITEM, isNavActive } from "./nav-items";

const STORAGE_KEY = "vh:sidebar-collapsed";

const ACTIVE = "bg-[rgba(82,125,216,0.1)] text-[#527dd8]";
const INACTIVE = "text-muted hover:bg-canvas hover:text-ink";

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

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-line bg-[#fbfbf9] transition-[width] duration-200 dark:bg-surface ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Brand */}
      <div className={`flex items-center py-5 ${collapsed ? "justify-center px-0" : "gap-2.5 px-5"}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          V
        </div>
        {!collapsed && (
          <span className="text-lg font-medium tracking-tight text-ink">
            Vikarhjelp
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex h-9 items-center rounded-xl text-sm font-medium transition ${
                collapsed ? "justify-center px-0" : "gap-2 px-3"
              } ${active ? ACTIVE : INACTIVE}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: collapse toggle, theme, settings, sign out */}
      <div className="space-y-1 border-t border-line p-3">
        <button
          onClick={toggle}
          title={collapsed ? "Vis meny" : "Skjul meny"}
          className={`flex w-full items-center rounded-lg py-2 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink ${
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          }`}
        >
          <ChevronLeft
            className={`h-[18px] w-[18px] shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
            strokeWidth={1.8}
          />
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
            <Sun className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
          ) : (
            <Moon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
          )}
          {!collapsed && (dark ? "Lyst tema" : "Mørkt tema")}
        </button>

        <Link
          href={SETTINGS_ITEM.href}
          title={collapsed ? SETTINGS_ITEM.label : undefined}
          className={`flex w-full items-center rounded-lg py-2 text-sm font-medium transition ${
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          } ${isNavActive(pathname, SETTINGS_ITEM.href) ? ACTIVE : INACTIVE}`}
        >
          <SETTINGS_ITEM.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
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
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            {!collapsed && "Logg ut"}
          </button>
        </form>
      </div>
    </aside>
  );
}
