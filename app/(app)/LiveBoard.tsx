"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import type { BoardLesson, BoardTeacher, TodayBoard } from "@/lib/queries/board";

const ROW_H = 64; // px per teacher row
const HEAD_H = 36; // px for the time-tick header

// Light grey diagonal stripes to flag an absent teacher's whole row.
const ABSENT_STRIPES =
  "repeating-linear-gradient(45deg, rgba(17,17,17,0.05) 0, rgba(17,17,17,0.05) 6px, transparent 6px, transparent 12px)";

function toMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
function fmtClock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
/** Current time-of-day in minutes, in Europe/Oslo. */
function osloNowMinutes(): number {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

type Activity =
  | { state: "class"; lesson: BoardLesson }
  | { state: "borte" }
  | { state: "free" };

function activityNow(t: BoardTeacher, now: number): Activity {
  if (t.absent) {
    const w = t.absenceWindow;
    const inWindow = !w || (toMin(w.from) <= now && now < toMin(w.to));
    if (inWindow) return { state: "borte" };
  }
  for (const l of t.lessons) {
    if (toMin(l.start) <= now && now < toMin(l.end)) {
      if (l.kind === "own" && l.coveredAway) continue; // they're away for this one
      return { state: "class", lesson: l };
    }
  }
  return { state: "free" };
}

export function LiveBoard({ board }: { board: TodayBoard }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);

  // Tick the clock (and keep the server data fresh for a TV left on all day).
  useEffect(() => {
    const update = () => setNow(osloNowMinutes());
    update();
    const tick = setInterval(update, 20_000);
    const refresh = setInterval(() => router.refresh(), 5 * 60_000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  if (board.weekday == null) {
    return (
      <Card className="p-8 text-center text-muted">
        Det er helg — ingen undervisning i dag.
      </Card>
    );
  }

  const startMin = toMin(board.dayStart);
  const endMin = toMin(board.dayEnd);
  const range = Math.max(1, endMin - startMin);
  const pct = (min: number) => ((min - startMin) / range) * 100;

  const ticks: number[] = [];
  for (let m = Math.ceil(startMin / 60) * 60; m <= endMin; m += 60) ticks.push(m);

  const nowInRange = now != null && now >= startMin && now <= endMin;

  // Live headline counts.
  let inClass = 0;
  let free = 0;
  let away = 0;
  if (now != null) {
    for (const t of board.teachers) {
      if (t.role === "vikar") continue; // headline counts are about teachers
      const a = activityNow(t, now);
      if (a.state === "class") inClass += 1;
      else if (a.state === "borte") away += 1;
      else free += 1;
    }
  }

  return (
    <div className="space-y-3">
      {/* Headline */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="tabular text-3xl font-semibold text-ink">
            {now == null ? "––:––" : fmtClock(now)}
          </span>
          {now != null && (
            <span className="text-sm text-muted">
              <b className="text-emerald-700">{inClass}</b> i klasse ·{" "}
              <b className="text-ink">{free}</b> ledige ·{" "}
              <b className="text-red-700">{away}</b> borte
            </span>
          )}
        </div>
        <span className="text-xs text-muted">Oppdateres automatisk</span>
      </div>

      <Card className="overflow-hidden">
        <div className="flex">
          {/* Left: teacher names + live status */}
          <div className="w-48 shrink-0 border-r border-line">
            <div
              className="flex items-center px-3 text-xs font-medium uppercase tracking-wide text-muted"
              style={{ height: HEAD_H }}
            >
              Lærer
            </div>
            {board.teachers.map((t) => {
              const act = now == null ? null : activityNow(t, now);
              return (
                <div
                  key={t.id}
                  className={`flex flex-col justify-center border-t border-line px-3 ${
                    t.absent ? "bg-canvas/60" : ""
                  }`}
                  style={{ height: ROW_H }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-ink">{t.name}</span>
                    {t.role === "vikar" && (
                      <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                        Vikar
                      </span>
                    )}
                  </div>
                  {act && <StatusLine act={act} />}
                </div>
              );
            })}
          </div>

          {/* Right: scrollable timeline */}
          <div className="flex-1 overflow-x-auto">
            <div className="relative min-w-[680px]">
              {/* Time ticks */}
              <div className="relative border-b border-line" style={{ height: HEAD_H }}>
                {ticks.map((m) => (
                  <div
                    key={m}
                    className="absolute top-0 flex h-full items-center"
                    style={{ left: `${pct(m)}%` }}
                  >
                    <span className="tabular -translate-x-1/2 text-[11px] text-muted">
                      {fmtClock(m)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div className="relative">
                {/* hour gridlines */}
                {ticks.map((m) => (
                  <div
                    key={`g${m}`}
                    className="absolute top-0 bottom-0 w-px bg-line/70"
                    style={{ left: `${pct(m)}%` }}
                  />
                ))}

                {board.teachers.map((t) => (
                  <div
                    key={t.id}
                    className={`relative border-t border-line ${t.absent ? "bg-canvas/40" : ""}`}
                    style={{
                      height: ROW_H,
                      ...(t.absent ? { backgroundImage: ABSENT_STRIPES } : {}),
                    }}
                  >
                    {t.lessons.map((l) => (
                      <LessonBlock
                        key={l.id}
                        lesson={l}
                        left={pct(toMin(l.start))}
                        width={pct(toMin(l.end)) - pct(toMin(l.start))}
                      />
                    ))}
                  </div>
                ))}

                {/* Live now-line */}
                {nowInRange && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-red-500"
                    style={{ left: `${pct(now!)}%` }}
                  >
                    <div className="tabular absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-full rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {fmtClock(now!)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Legend />
    </div>
  );
}

function StatusLine({ act }: { act: Activity }) {
  if (act.state === "borte") {
    return <span className="text-xs font-medium text-red-700">● Borte</span>;
  }
  if (act.state === "free") {
    return <span className="text-xs font-medium text-muted">● Ledig</span>;
  }
  const l = act.lesson;
  const label =
    l.kind === "covering"
      ? `Dekker ${[l.subject, l.classGroup].filter(Boolean).join(" ")}`
      : [l.subject, l.classGroup].filter(Boolean).join(" ");
  return (
    <span className="truncate text-xs font-medium text-emerald-700" title={label}>
      ● {label || "I klasse"}
    </span>
  );
}

function LessonBlock({
  lesson,
  left,
  width,
}: {
  lesson: BoardLesson;
  left: number;
  width: number;
}) {
  let cls = "bg-brand-100/70 text-brand-900 ring-brand-200";
  let prefix = "";
  if (lesson.kind === "covering") {
    cls = "bg-violet-100/70 text-violet-800 ring-violet-200";
    prefix = "Dekker: ";
  } else if (lesson.coveredAway) {
    cls = "bg-canvas text-muted ring-line";
  }
  const title = [lesson.subject, lesson.classGroup].filter(Boolean).join(" · ");
  return (
    <div
      className={`absolute top-1.5 bottom-1.5 overflow-hidden rounded-md px-2 py-1 text-[11px] leading-tight ring-1 ${cls}`}
      style={{ left: `${left}%`, width: `calc(${width}% - 4px)` }}
      title={title}
    >
      <div className="truncate font-medium">
        {prefix}
        {lesson.subject ?? "Time"}
        {lesson.classGroup ? ` · ${lesson.classGroup}` : ""}
      </div>
      {lesson.kind === "own" && lesson.coveredAway ? (
        <div className="truncate">
          Borte{lesson.coveringName ? ` → ${lesson.coveringName}` : ""}
        </div>
      ) : lesson.kind === "covering" ? (
        <div className="truncate opacity-80">for {lesson.coverForName}</div>
      ) : (
        <div className="truncate opacity-70">
          {[lesson.room, `${lesson.start}–${lesson.end}`].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

function Legend() {
  const items = [
    { cls: "bg-brand-100 ring-brand-200", label: "Egen time" },
    { cls: "bg-violet-100 ring-violet-200", label: "Dekker for andre" },
    { cls: "bg-canvas ring-line", label: "Borte / dekket" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded ring-1 ${i.cls}`} />
          {i.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-0.5 bg-red-500" />
        Nå
      </span>
    </div>
  );
}
