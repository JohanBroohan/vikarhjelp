"use client";

import { useState } from "react";
import type { Lesson, Teacher } from "@/lib/database.types";
import { PERIODS, PERIOD_TIMES, WEEKDAYS, WEEKDAY_NAMES } from "@/lib/constants";
import { Card, Select } from "@/components/ui";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-ink">Vis:</span>
        <div className="w-64">
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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-20 border-b border-r border-line bg-canvas px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Time
                </th>
                {WEEKDAYS.map((wd) => (
                  <th
                    key={wd}
                    className="border-b border-line bg-canvas px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted"
                  >
                    {WEEKDAY_NAMES[wd]}
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
                      <td
                        key={wd}
                        className="border-b border-line align-top p-1.5"
                      >
                        <div className="flex flex-col gap-1">
                          {items.map((l) => (
                            <div
                              key={l.id}
                              className="rounded-md bg-brand-50/60 px-2 py-1 ring-1 ring-brand-100"
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
                            </div>
                          ))}
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
    </div>
  );
}
