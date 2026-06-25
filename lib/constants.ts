// Shared, app-wide constants. Code/identifiers in English; user-facing strings
// in Norwegian (bokmål) since the principal is the only user.

/**
 * The school's canonical daily time slots, taken from the staff timetable
 * template (one row per slot, identical for every teacher and every week). The
 * importer maps each grid row to one of these by its start time, and the
 * coverage engine uses `period` (= the slot number below) as the scheduling
 * slot. Edit this list if the school's bell schedule changes.
 */
export const PERIOD_TIMES: Record<
  number,
  { start: string; end: string; label?: string }
> = {
  1: { start: "07:30", end: "08:00" },
  2: { start: "08:00", end: "08:30" },
  3: { start: "08:30", end: "11:30", label: "1. økt" },
  4: { start: "11:30", end: "12:00" },
  5: { start: "12:00", end: "12:30" },
  6: { start: "12:30", end: "13:00" },
  7: { start: "13:00", end: "15:00", label: "2. økt" },
  8: { start: "15:00", end: "16:00" },
  9: { start: "16:00", end: "16:30" },
};

export const PERIODS: number[] = Object.keys(PERIOD_TIMES)
  .map(Number)
  .sort((a, b) => a - b);
export const PERIOD_COUNT = PERIODS.length;

/** start_time ("HH:MM") -> period number, for matching imported grid rows. */
export const PERIOD_BY_START: Record<string, number> = Object.fromEntries(
  PERIODS.map((p) => [PERIOD_TIMES[p].start, p]),
);

/** The school day's outer bounds, derived from the first/last slot. */
export const SCHOOL_DAY_START = PERIOD_TIMES[PERIODS[0]].start;
export const SCHOOL_DAY_END = PERIOD_TIMES[PERIODS[PERIODS.length - 1]].end;

/**
 * Words that mark a timetable cell as a NON-teaching activity (office time,
 * breaks, supervision, meetings, …) rather than a class needing a substitute.
 * Matched case-insensitively as substrings. Edit freely.
 */
export const NON_TEACHING_KEYWORDS = [
  "kontor",
  "pause",
  "lunsj",
  "elevlunsj",
  "tilsyn",
  "møte",
  "teammøte",
  "utetid",
  "fri",
  "planlegging",
  "forberedelse",
  "ferie",
];

/**
 * Is this timetable cell a real class (needs covering when the teacher is out)?
 * Empty cells aren't activities at all; non-teaching items match a keyword.
 */
export function isClassActivity(subject: string | null | undefined): boolean {
  const s = (subject ?? "").trim().toLowerCase();
  if (!s) return false;
  return !NON_TEACHING_KEYWORDS.some((k) => s.includes(k));
}

/**
 * Non-teaching activities that DON'T tie a teacher up — they're flexible desk
 * time, so the teacher can still be pulled in to cover another class. Everything
 * else (classes, plus duties like supervision/meetings/breaks) keeps them busy.
 */
export const AVAILABLE_KEYWORDS = [
  "kontor",
  "planlegging",
  "forberedelse",
  "fri",
  "ledig",
];

/**
 * Does this activity make the teacher unavailable to cover another class?
 *  - empty slot  -> false (free)
 *  - a class     -> true  (teaching)
 *  - "Kontor" etc -> false (flexible, can be pulled in)
 *  - other duties -> true  (supervision, meeting, break, …)
 */
export function occupiesTeacher(subject: string | null | undefined): boolean {
  const s = (subject ?? "").trim().toLowerCase();
  if (!s) return false;
  if (isClassActivity(subject)) return true;
  return !AVAILABLE_KEYWORDS.some((k) => s.includes(k));
}

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

/**
 * Absence types ("fraværstype"). Egenmelding is the default (~95% of cases).
 * These labels are placeholders — rename them here as needed.
 */
export const ABSENCE_TYPES: { value: string; label: string }[] = [
  { value: "egenmelding", label: "Egenmelding" },
  { value: "sykemelding", label: "Sykemelding" },
  { value: "barns_sykdom", label: "Barns sykdom" },
  { value: "velferdspermisjon", label: "Velferdspermisjon" },
  { value: "annet", label: "Annet" },
];
export const DEFAULT_ABSENCE_TYPE = "egenmelding";

export function absenceTypeLabel(value: string | null | undefined): string {
  return ABSENCE_TYPES.find((t) => t.value === value)?.label ?? "Egenmelding";
}

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
