"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const BTN =
  "rounded-xl px-3.5 py-2 text-sm font-medium text-brand-700 ring-1 ring-line hover:bg-brand-50";

const OPTIONS = [
  { what: "begge", label: "Fravær og vikartimer" },
  { what: "vikartimer", label: "Kun vikartimer" },
  { what: "fravaer", label: "Kun fravær" },
];

export function ExportCsvMenu({
  query,
  suffix = "",
  absencesAvailable,
}: {
  query: string;
  suffix?: string;
  absencesAvailable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const href = (what: string) =>
    `/api/export/ekstratimer?${query}${suffix}&what=${what}`;

  // Vikars have no absences — a single, plain export.
  if (!absencesAvailable) {
    return (
      <a href={href("vikartimer")} className={BTN}>
        Eksporter CSV
      </a>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${BTN} inline-flex items-center gap-1.5`}
      >
        Eksporter CSV
        <ChevronDown className="h-4 w-4" strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
          {OPTIONS.map((o) => (
            <a
              key={o.what}
              href={href(o.what)}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-ink hover:bg-canvas"
            >
              {o.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
