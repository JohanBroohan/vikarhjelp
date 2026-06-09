// Shared, app-wide constants. Code/identifiers in English; user-facing strings
// in Norwegian (bokmål) since the principal is the only user.

/**
 * Periods ("timer") per school day. The grid runs period 1..PERIOD_COUNT.
 * This is a Montessori school with two long work cycles per day, so 2.
 * Change this single value to support a different number of periods.
 */
export const PERIOD_COUNT = 2;
export const PERIODS: number[] = Array.from(
  { length: PERIOD_COUNT },
  (_, i) => i + 1,
);

/**
 * Default clock for each period (display only; used to prefill the editor).
 * Two Montessori work cycles: a long morning block and an afternoon block.
 */
export const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "08:30", end: "11:30" },
  2: { start: "12:30", end: "15:00" },
};

/** The school day's outer bounds, derived from the first/last period. */
export const SCHOOL_DAY_START = PERIOD_TIMES[1].start;
export const SCHOOL_DAY_END = PERIOD_TIMES[PERIOD_COUNT].end;

/**
 * Effective clock times for a lesson — its own start/end if set, otherwise the
 * default period clock. Used to decide whether a lesson falls inside a
 * partial-day absence window.
 */
export function lessonClock(lesson: {
  period: number;
  start_time: string | null;
  end_time: string | null;
}): { start: string; end: string } {
  return {
    start: lesson.start_time || PERIOD_TIMES[lesson.period]?.start || "00:00",
    end: lesson.end_time || PERIOD_TIMES[lesson.period]?.end || "23:59",
  };
}

/**
 * Does a lesson overlap an absence time window? `window` of null means the
 * teacher is out the whole day, so every lesson is included. Times are "HH:MM"
 * strings, which compare correctly lexicographically.
 */
export function lessonInWindow(
  lesson: { period: number; start_time: string | null; end_time: string | null },
  window: { from: string; to: string } | null,
): boolean {
  if (!window) return true;
  const { start, end } = lessonClock(lesson);
  return start < window.to && end > window.from;
}

/** Weekdays Monday=1 .. Friday=5 (the only schedulable days). */
export const WEEKDAYS = [1, 2, 3, 4, 5] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Full Norwegian weekday names, indexed by weekday number (1..5). */
export const WEEKDAY_NAMES: Record<number, string> = {
  1: "Mandag",
  2: "Tirsdag",
  3: "Onsdag",
  4: "Torsdag",
  5: "Fredag",
};

/** Short labels for compact grids. */
export const WEEKDAY_SHORT: Record<number, string> = {
  1: "Man",
  2: "Tir",
  3: "Ons",
  4: "Tor",
  5: "Fre",
};

/**
 * Accepted spellings when importing a timetable. Maps loosely-typed Norwegian
 * day text to the canonical weekday number. Keys are compared lower-cased and
 * trimmed.
 */
export const WEEKDAY_ALIASES: Record<string, number> = {
  "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
  man: 1, mandag: 1, mon: 1, monday: 1,
  tir: 2, tirsdag: 2, tis: 2, tue: 2, tuesday: 2,
  ons: 3, onsdag: 3, wed: 3, wednesday: 3,
  tor: 4, torsdag: 4, thu: 4, thursday: 4,
  fre: 5, fredag: 5, fri: 5, friday: 5,
};

export type CoverageStatus =
  | "pending"
  | "covered_by_teacher"
  | "covered_by_vikar"
  | "covered_by_coteacher"
  | "uncovered";

/** Norwegian label + semantic CSS class for each coverage status. */
export const STATUS_META: Record<
  CoverageStatus,
  { label: string; className: string }
> = {
  pending: { label: "Venter", className: "status-pending" },
  covered_by_teacher: { label: "Dekket av lærer", className: "status-covered" },
  covered_by_vikar: { label: "Dekket av vikar", className: "status-covered" },
  covered_by_coteacher: {
    label: "Dekket av medlærer",
    className: "status-coteacher",
  },
  uncovered: { label: "Udekket", className: "status-uncovered" },
};
