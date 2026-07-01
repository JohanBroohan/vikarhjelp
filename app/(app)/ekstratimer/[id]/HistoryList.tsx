"use client";

import { useState } from "react";
import type { CoverRow, AbsenceRow } from "@/lib/queries/extraHours";
import { formatDateCompact, capitalize } from "@/lib/format";
import { absenceTypeLabel } from "@/lib/constants";

type Filter = "alle" | "vikartimer" | "fravaer";

type Entry =
  | { kind: "cover"; date: string; row: CoverRow }
  | { kind: "absence"; date: string; row: AbsenceRow };

const TABS: { key: Filter; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "vikartimer", label: "Vikartimer" },
  { key: "fravaer", label: "Fravær" },
];

export function HistoryList({
  covers,
  absences,
}: {
  covers: CoverRow[];
  absences: AbsenceRow[];
}) {
  const [filter, setFilter] = useState<Filter>("alle");
  const hasAbsences = absences.length > 0;

  const entries: Entry[] = [
    ...covers.map((r) => ({ kind: "cover" as const, date: r.date, row: r })),
    ...absences.map((r) => ({ kind: "absence" as const, date: r.date, row: r })),
  ]
    .filter((e) =>
      filter === "alle"
        ? true
        : filter === "vikartimer"
          ? e.kind === "cover"
          : e.kind === "absence",
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="text-sm text-muted">{entries.length} oppføringer</p>
        {/* The filter only makes sense for staff who can be absent (not vikars). */}
        {hasAbsences && (
          <div className="inline-flex rounded-xl bg-canvas p-0.5 ring-1 ring-line">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`rounded-lg px-3 py-1 text-sm font-medium transition ${
                  filter === t.key
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Dato</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Detaljer</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr
                key={`${e.kind}-${e.row.id}`}
                className="border-b border-line/70 last:border-0 hover:bg-canvas/50"
              >
                <td className="whitespace-nowrap px-4 py-3 text-ink">
                  {capitalize(formatDateCompact(e.date))}
                </td>
                <td className="px-4 py-3">
                  {e.kind === "cover" ? (
                    <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-[rgba(158,122,225,0.15)] dark:text-[#9e7ae1]">
                      Vikartime
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      Fravær
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {e.kind === "cover" ? coverDetail(e.row) : absenceDetail(e.row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function coverDetail(r: CoverRow): string {
  const cls = [r.subject, r.classGroup].filter(Boolean).join(" ");
  return `${r.period}. time${cls ? ` · ${cls}` : ""} · dekket for ${r.absentTeacherName}`;
}

function absenceDetail(r: AbsenceRow): string {
  const when = r.window ? `kl. ${r.window.from}–${r.window.to}` : "Hele dagen";
  return `${absenceTypeLabel(r.absenceType)} · ${when}`;
}
