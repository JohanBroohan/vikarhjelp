"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { EMPLOYEE_ROLES } from "@/lib/constants";
import type { BoardLesson, BoardTeacher, TodayBoard } from "@/lib/queries/board";

// Tables whose changes should immediately refresh the board.
const REALTIME_TABLES = [
  "teachers",
  "vikars",
  "lessons",
  "absences",
  "coverage_assignments",
] as const;

const ROW_H = 64; // px per teacher row (max)
const ROW_MIN = 34; // px per teacher row (min, when squeezing to fit a TV)
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
  | { state: "lesson"; lesson: BoardLesson }
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
      return { state: "lesson", lesson: l };
    }
  }
  return { state: "free" };
}

/* Filters ------------------------------------------------------------------ */

const FILTERS_KEY = "oversikt-filters";

type Filters = {
  /** Which employee "stillinger" to show, keyed by role slug. */
  stillinger: Record<string, boolean>;
  hideAbsent: boolean;
  onlyFree: boolean;
  onlyInClass: boolean;
  showVikars: boolean;
};

const DEFAULT_FILTERS: Filters = {
  stillinger: Object.fromEntries(EMPLOYEE_ROLES.map((r) => [r.value, true])),
  hideAbsent: false,
  onlyFree: false,
  onlyInClass: false,
  showVikars: true,
};

function isDefaultFilters(f: Filters): boolean {
  return (
    !f.hideAbsent &&
    !f.onlyFree &&
    !f.onlyInClass &&
    f.showVikars &&
    EMPLOYEE_ROLES.every((r) => f.stillinger[r.value] !== false)
  );
}

// The selection is persisted per-browser in localStorage and exposed through
// useSyncExternalStore, so the server/first-hydration render uses the defaults
// and the saved value is applied right after — no hydration mismatch and no
// setState-in-effect. An in-memory cache is the source of truth (loaded from
// storage once) and gives getSnapshot a referentially stable value between
// changes, as useSyncExternalStore requires.
let filtersLoaded = false;
let cachedFilters: Filters = DEFAULT_FILTERS;
const filterListeners = new Set<() => void>();

function readFilters(): Filters {
  if (!filtersLoaded) {
    filtersLoaded = true;
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Filters>;
        cachedFilters = {
          ...DEFAULT_FILTERS,
          ...saved,
          stillinger: { ...DEFAULT_FILTERS.stillinger, ...(saved.stillinger ?? {}) },
        };
      }
    } catch {
      /* storage unavailable or corrupt — keep the defaults */
    }
  }
  return cachedFilters;
}

function subscribeFilters(cb: () => void): () => void {
  filterListeners.add(cb);
  return () => filterListeners.delete(cb);
}

function writeFilters(next: Filters) {
  cachedFilters = next;
  filtersLoaded = true;
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — value still lives in memory for this session */
  }
  filterListeners.forEach((l) => l());
}

export function LiveBoard({
  board,
  isToday,
}: {
  board: TodayBoard;
  isToday: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [rowH, setRowH] = useState(ROW_H);

  const filters = useSyncExternalStore(
    subscribeFilters,
    readFilters,
    () => DEFAULT_FILTERS,
  );
  const setFilters: Dispatch<SetStateAction<Filters>> = (action) =>
    writeFilters(
      typeof action === "function"
        ? (action as (prev: Filters) => Filters)(readFilters())
        : action,
    );

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

  // Realtime: refresh the instant an absence, cover, or timetable row changes,
  // so edits made on the principal's computer appear on the TV immediately.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let cleanup = () => {};

    // Debounce bursts (e.g. a timetable import) into a single refresh.
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        router.refresh();
      }, 600);
    };

    const start = async () => {
      try {
        const supabase = createClient();

        // IMPORTANT: Realtime enforces row-level security, so the socket must
        // carry the logged-in user's token *before* subscribing — otherwise it
        // connects as anon and silently receives no changes.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
        if (cancelled) return;

        const channel = supabase.channel("oversikt-realtime");
        for (const table of REALTIME_TABLES) {
          channel.on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            scheduleRefresh,
          );
        }
        channel.subscribe((status) => {
          // When the subscription (re)connects, pull the latest once to catch
          // anything that changed while we were connecting.
          if (status === "SUBSCRIBED") scheduleRefresh();
        });

        cleanup = () => supabase.removeChannel(channel);
      } catch {
        /* realtime unavailable — the periodic poll above still refreshes */
      }
    };

    start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      cleanup();
    };
  }, [router]);

  // Apply the active filters. Status filters ("Ledige nå"/"I klasse") only make
  // sense for today's live view, so they're ignored on other days.
  const liveStatus = isToday && now != null;
  const visibleTeachers = board.teachers.filter((t) => {
    if (t.role === "vikar") return filters.showVikars;
    if (filters.stillinger[t.stilling ?? ""] === false) return false;
    if (filters.hideAbsent && t.absent) return false;
    if ((filters.onlyFree || filters.onlyInClass) && liveStatus) {
      const act = activityNow(t, now!);
      const isFree = act.state === "free";
      const isInClass = act.state === "lesson" && act.lesson.isClass;
      if (!((filters.onlyFree && isFree) || (filters.onlyInClass && isInClass)))
        return false;
    }
    return true;
  });

  // On large screens, shrink rows so every teacher fits without scrolling
  // (the TV has no one to scroll it). Small screens keep full height + scroll.
  const rowCount = visibleTeachers.length;
  useEffect(() => {
    const recompute = () => {
      const el = rowsRef.current;
      if (!el || !window.matchMedia("(min-width: 1024px)").matches) {
        setRowH(ROW_H);
        return;
      }
      const top = el.getBoundingClientRect().top;
      const reserve = 60; // legend + breathing room below
      const avail = window.innerHeight - top - reserve;
      const n = Math.max(1, rowCount);
      setRowH(Math.max(ROW_MIN, Math.min(ROW_H, Math.floor(avail / n))));
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [rowCount]);

  if (board.weekday == null) {
    return (
      <Card className="p-8 text-center text-muted">
        Det er helg — ingen undervisning denne dagen.
      </Card>
    );
  }

  const startMin = toMin(board.dayStart);
  const endMin = toMin(board.dayEnd);
  const range = Math.max(1, endMin - startMin);
  const pct = (min: number) => ((min - startMin) / range) * 100;

  const ticks: number[] = [];
  for (let m = Math.ceil(startMin / 60) * 60; m <= endMin; m += 60) ticks.push(m);

  const nowInRange = isToday && now != null && now >= startMin && now <= endMin;

  return (
    <div>
      {/* Filters — top right of the timeline. */}
      <div className="mb-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <FilterBar filters={filters} setFilters={setFilters} showStatus={isToday} />
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
            {visibleTeachers.map((t) => {
              const act = isToday && now != null ? activityNow(t, now) : null;
              return (
                <div
                  key={t.id}
                  className={`flex flex-col justify-center overflow-hidden border-t border-line px-3 leading-tight ${
                    t.absent ? "bg-canvas/60" : ""
                  }`}
                  style={{ height: rowH }}
                >
                  <div className="flex items-center gap-1.5">
                    {t.role === "teacher" ? (
                      <Link
                        href={`/laerere/${t.id}?from=oversikt`}
                        className="truncate text-sm font-medium text-ink hover:text-brand-700 hover:underline"
                      >
                        {t.name}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-medium text-ink">{t.name}</span>
                    )}
                    {t.role === "vikar" && (
                      <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-[rgba(158,122,225,0.1)] dark:text-[#9e7ae1] dark:ring-1 dark:ring-[rgba(158,122,225,0.3)]">
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
              <div className="relative" style={{ height: HEAD_H }}>
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
              <div className="relative" ref={rowsRef}>
                {/* hour gridlines */}
                {ticks.map((m) => (
                  <div
                    key={`g${m}`}
                    className="absolute top-0 bottom-0 w-px bg-line/70"
                    style={{ left: `${pct(m)}%` }}
                  />
                ))}

                {visibleTeachers.map((t) => (
                  <div
                    key={t.id}
                    className={`relative border-t border-line ${t.absent ? "bg-canvas/40" : ""}`}
                    style={{
                      height: rowH,
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

      {visibleTeachers.length === 0 && (
        <p className="mt-3 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Ingen ansatte matcher filteret.
        </p>
      )}

      <div className="mt-4">
        <Legend />
      </div>
    </div>
  );
}

function FilterBar({
  filters,
  setFilters,
  showStatus,
}: {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  showStatus: boolean;
}) {
  const toggleStilling = (v: string) =>
    setFilters((f) => ({
      ...f,
      stillinger: { ...f.stillinger, [v]: f.stillinger[v] === false },
    }));

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {EMPLOYEE_ROLES.map((r) => (
        <Chip
          key={r.value}
          active={filters.stillinger[r.value] !== false}
          onClick={() => toggleStilling(r.value)}
        >
          {r.label}
        </Chip>
      ))}
      <Divider />
      <Chip
        active={filters.showVikars}
        onClick={() => setFilters((f) => ({ ...f, showVikars: !f.showVikars }))}
      >
        Vikarer
      </Chip>
      <Chip
        active={filters.hideAbsent}
        onClick={() => setFilters((f) => ({ ...f, hideAbsent: !f.hideAbsent }))}
      >
        Skjul fraværende
      </Chip>
      {showStatus && (
        <>
          <Divider />
          <Chip
            active={filters.onlyFree}
            onClick={() => setFilters((f) => ({ ...f, onlyFree: !f.onlyFree }))}
          >
            Ledige nå
          </Chip>
          <Chip
            active={filters.onlyInClass}
            onClick={() => setFilters((f) => ({ ...f, onlyInClass: !f.onlyInClass }))}
          >
            I klasse
          </Chip>
        </>
      )}
      {!isDefaultFilters(filters) && (
        <button
          type="button"
          onClick={() => setFilters(DEFAULT_FILTERS)}
          className="ml-1 text-xs text-muted underline hover:text-ink"
        >
          Nullstill
        </button>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active ? "bg-ink text-white" : "text-muted ring-1 ring-line hover:bg-canvas"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />;
}

function StatusLine({ act }: { act: Activity }) {
  if (act.state === "borte") {
    return <span className="text-xs font-medium text-red-700">● Borte</span>;
  }
  if (act.state === "free") {
    return <span className="text-xs font-medium text-muted">● Ledig</span>;
  }
  const l = act.lesson;
  // Non-teaching activity (office, supervision, meeting…): show it, but neutral.
  if (!l.isClass) {
    return (
      <span className="truncate text-xs font-medium text-muted" title={l.subject ?? ""}>
        ● {l.subject || "Opptatt"}
      </span>
    );
  }
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
  let cls =
    "bg-brand-100/70 text-brand-900 ring-brand-200 dark:bg-[rgba(57,102,193,0.1)] dark:text-[#bdc1cd] dark:ring-[rgba(57,102,193,0.4)]";
  let prefix = "";
  if (lesson.kind === "covering") {
    cls =
      "bg-violet-100/70 text-violet-800 ring-violet-200 dark:bg-[rgba(158,122,225,0.1)] dark:text-[#9e7ae1] dark:ring-[rgba(158,122,225,0.3)]";
    prefix = "Dekker: ";
  } else if (lesson.coveredAway) {
    cls = "bg-canvas text-muted ring-line";
  } else if (!lesson.isClass) {
    // Non-teaching activity (office time, breaks, supervision, meetings).
    cls = "bg-canvas/70 text-muted ring-line";
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
    {
      cls: "bg-brand-100 ring-brand-200 dark:bg-[rgba(57,102,193,0.1)] dark:ring-[rgba(57,102,193,0.4)]",
      label: "Klasse",
    },
    {
      cls: "bg-violet-100 ring-violet-200 dark:bg-[rgba(158,122,225,0.1)] dark:ring-[rgba(158,122,225,0.3)]",
      label: "Dekker for andre",
    },
    { cls: "bg-canvas ring-line", label: "Annet / borte" },
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
