"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateLong, capitalize, todayISO } from "@/lib/format";

const MONTHS = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];
const DOW = ["ma", "ti", "on", "to", "fr", "lø", "sø"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toISO(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`; // m is 1-12
}
function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12
}
/** Weekday of the 1st, Monday=0 .. Sunday=6. */
function firstWeekdayMonFirst(y: number, m: number) {
  const g = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
  return (g + 6) % 7;
}

/**
 * Norwegian, day-first date field. Shows the selected date as "tirsdag 9. juni
 * 2026" and opens a Monday-first calendar popover. Value/onChange use ISO
 * (YYYY-MM-DD). Replaces the native <input type="date">, whose display order is
 * locale-controlled and can't be forced to day-first.
 */
export function DateField({
  value,
  onChange,
  trigger,
}: {
  value: string;
  onChange: (iso: string) => void;
  /** Optional custom trigger; falls back to the default bordered field. */
  trigger?: (args: { open: boolean; toggle: () => void }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [vy, vm] = value
    ? value.split("-").map(Number)
    : todayISO().split("-").map(Number);
  const [viewYear, setViewYear] = useState(vy);
  const [viewMonth, setViewMonth] = useState(vm); // 1-12

  function toggleOpen() {
    // When opening, jump the calendar view to the selected month.
    if (!open && value) {
      const [y, m] = value.split("-").map(Number);
      setViewYear(y);
      setViewMonth(m);
    }
    setOpen((o) => !o);
  }

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 1) {
        setViewYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }
  function nextMonth() {
    setViewMonth((m) => {
      if (m === 12) {
        setViewYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }

  const lead = firstWeekdayMonFirst(viewYear, viewMonth);
  const total = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  const today = todayISO();

  return (
    <div className="relative" ref={containerRef}>
      {trigger ? (
        trigger({ open, toggle: toggleOpen })
      ) : (
        <button
          type="button"
          onClick={toggleOpen}
          className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        >
          <span>{value ? capitalize(formatDateLong(value)) : "Velg dato …"}</span>
          <svg
            className="h-4 w-4 shrink-0 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
          >
            <path d="M8 2v4M16 2v4M3 9h18M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
          </svg>
        </button>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Forrige måned"
              className="rounded-xl p-1.5 text-muted hover:bg-canvas hover:text-ink"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-sm font-medium text-ink">
              {capitalize(MONTHS[viewMonth - 1])} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Neste måned"
              className="rounded-xl p-1.5 text-muted hover:bg-canvas hover:text-ink"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted">
            {DOW.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`b${i}`} />;
              const iso = toISO(viewYear, viewMonth, day);
              const isSelected = iso === value;
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`tabular h-8 rounded-xl text-sm transition ${
                    isSelected
                      ? "bg-brand-600 font-medium text-white"
                      : isToday
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink hover:bg-canvas"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-line pt-2 text-center">
            <button
              type="button"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              I dag
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
