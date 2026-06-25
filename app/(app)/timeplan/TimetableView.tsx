"use client";

import { useEffect, useState, useTransition } from "react";
import type { Lesson, Teacher } from "@/lib/database.types";
import {
  PERIODS,
  PERIOD_TIMES,
  WEEKDAYS,
  WEEKDAY_NAMES,
  isClassActivity,
  type CoverageStatus,
} from "@/lib/constants";
import {
  todayISO,
  mondayOfWeekISO,
  addDaysISO,
  isoWeekNumber,
  formatDayMonth,
  capitalize,
} from "@/lib/format";
import { Card, Select } from "@/components/ui";
import { getWeekOverlay, type WeekCoverageCell } from "@/lib/actions/coverage";

function slotKey(weekday: number, period: number) {
  return `${weekday}-${period}`;
}

export function TimetableView({
  teachers,
  lessons,
}: {
  teachers: Teacher[];
  lessons: Lesson[];
}) {
  const [filter, setFilter] = useState<string>("all");
  const [weekStart, setWeekStart] = useState(() => mondayOfWeekISO(todayISO()));
  const [overlay, setOverlay] = useState<Record<string, WeekCoverageCell>>({});
  const [loading, startLoad] = useTransition();

  // Load that week's absence/coverage overlay.
  useEffect(() => {
    startLoad(async () => {
      const data = await getWeekOverlay(weekStart);
      setOverlay(data);
    });
  }, [weekStart]);

  const nameById = new Map(teachers.map((t) => [t.id, t.name]));
  const visible =
    filter === "all" ? lessons : lessons.filter((l) => l.teacher_id === filter);

  const bySlot = new Map<string, Lesson[]>();
  for (const l of visible) {
    const k = slotKey(l.weekday, l.period);
    const arr = bySlot.get(k);
    if (arr) arr.push(l);
    else bySlot.set(k, [l]);
  }

  const thisWeek = mondayOfWeekISO(todayISO());
  const friday = addDaysISO(weekStart, 4);
  const weekLabel = `Uke ${isoWeekNumber(weekStart)}`;
  const rangeLabel = `${formatDayMonth(weekStart)}–${formatDayMonth(friday)} ${friday.slice(0, 4)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-ink">Vis:</span>
          <div className="w-56">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Hele skolen</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => addDaysISO(w, -7))}
            aria-label="Forrige uke"
            className="rounded-lg p-2 text-muted ring-1 ring-line transition hover:bg-canvas hover:text-ink"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="min-w-[180px] text-center">
            <div className="text-sm font-medium text-ink">{weekLabel}</div>
            <div className="text-xs text-muted">{rangeLabel}</div>
          </div>
          <button
            onClick={() => setWeekStart((w) => addDaysISO(w, 7))}
            aria-label="Neste uke"
            className="rounded-lg p-2 text-muted ring-1 ring-line transition hover:bg-canvas hover:text-ink"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          {weekStart !== thisWeek && (
            <button
              onClick={() => setWeekStart(thisWeek)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-line transition hover:bg-brand-50"
            >
              Denne uka
            </button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-20 border-b border-r border-line bg-canvas px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Time
                </th>
                {WEEKDAYS.map((wd) => (
                  <th
                    key={wd}
                    className="border-b border-line bg-canvas px-3 py-2.5 text-left"
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-muted">
                      {WEEKDAY_NAMES[wd]}
                    </div>
                    <div className="text-[11px] font-normal text-muted">
                      {capitalize(formatDayMonth(addDaysISO(weekStart, wd - 1)))}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((period) => (
                <tr key={period}>
                  <td className="border-b border-r border-line bg-canvas/60 px-3 py-2 align-top">
                    <div className="font-medium text-ink">{period}.</div>
                    <div className="tabular text-[11px] text-muted">
                      {PERIOD_TIMES[period]?.start}
                    </div>
                  </td>
                  {WEEKDAYS.map((wd) => {
                    const items = bySlot.get(slotKey(wd, period)) ?? [];
                    return (
                      <td key={wd} className="border-b border-line align-top p-1.5">
                        <div className="flex flex-col gap-1">
                          {items.map((l) => {
                            const cover = overlay[l.id];
                            const isClass = isClassActivity(l.subject);
                            return (
                              <div
                                key={l.id}
                                className={`rounded-md px-2 py-1 ring-1 ${
                                  cover
                                    ? "bg-canvas ring-line"
                                    : isClass
                                      ? "bg-brand-50/60 ring-brand-100"
                                      : "bg-canvas/70 ring-line"
                                }`}
                              >
                                <div className="font-medium text-ink">
                                  {l.subject ?? "Time"}
                                  {l.class_group ? (
                                    <span className="font-normal text-muted"> · {l.class_group}</span>
                                  ) : null}
                                </div>
                                {filter === "all" && (
                                  <div className="truncate text-[11px] text-muted">
                                    {nameById.get(l.teacher_id)}
                                    {l.room ? ` · ${l.room}` : ""}
                                  </div>
                                )}
                                {cover && <OverlayChip cell={cover} />}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {loading && <p className="text-xs text-muted">Laster dekning for uka …</p>}
    </div>
  );
}

function OverlayChip({ cell }: { cell: WeekCoverageCell }) {
  const text: Record<CoverageStatus, string> = {
    covered_by_teacher: `${cell.absentName} borte → ${cell.coveringName} dekker`,
    covered_by_vikar: `${cell.absentName} borte → ${cell.coveringName} (vikar)`,
    covered_by_coteacher: `${cell.absentName} borte · medlærer dekker`,
    pending: `${cell.absentName} borte · venter`,
    uncovered: `${cell.absentName} borte · udekket`,
  };
  const cls: Record<CoverageStatus, string> = {
    covered_by_teacher: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    covered_by_vikar: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    covered_by_coteacher: "bg-sky-50 text-sky-700 ring-sky-600/20",
    pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
    uncovered: "bg-red-50 text-red-700 ring-red-600/20",
  };
  return (
    <div className={`mt-1 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ${cls[cell.status]}`}>
      {text[cell.status]}
    </div>
  );
}
