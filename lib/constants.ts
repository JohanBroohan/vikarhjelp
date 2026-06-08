// Shared, app-wide constants. Code/identifiers in English; user-facing strings
// in Norwegian (bokmål) since the principal is the only user.

/** Periods per school day. The grid runs period 1..PERIOD_COUNT. */
export const PERIOD_COUNT = 8;
export const PERIODS: number[] = Array.from(
  { length: PERIOD_COUNT },
  (_, i) => i + 1,
);

/** Default clock for each period (display only; used to prefill the editor). */
export const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "08:30", end: "09:15" },
  2: { start: "09:15", end: "10:00" },
  3: { start: "10:15", end: "11:00" },
  4: { start: "11:00", end: "11:45" },
  5: { start: "12:15", end: "13:00" },
  6: { start: "13:00", end: "13:45" },
  7: { start: "13:55", end: "14:40" },
  8: { start: "14:40", end: "15:25" },
};

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
