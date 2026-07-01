// Formatting helpers. User-facing output is Norwegian (bokmål). Plain ISO date
// strings (YYYY-MM-DD) are treated as calendar dates in Europe/Oslo so they
// never drift by a day.

const OSLO = "Europe/Oslo";

/** Today's date as YYYY-MM-DD in the school's timezone. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: OSLO }).format(new Date());
}

/** "mandag 8. juni 2026" */
export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));
}

/** "8. jun. 2026" */
export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));
}

/** "ma. 8. jun." — compact for tables. */
export function formatDateCompact(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));
}

/** "01.07.2026" — day-first numeric (Norwegian). Used for CSV/exports. */
export function formatDateNumeric(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));
}

/** "8. juni" — day + long month, for week-grid headers. */
export function formatDayMonth(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));
}

/** Add (or subtract) whole days to an ISO date, returning a new ISO date. */
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday (ISO) of the week containing the given date. */
export function mondayOfWeekISO(iso: string): string {
  const day = new Date(iso + "T00:00:00Z").getUTCDay(); // 0=Sun..6=Sat
  return addDaysISO(iso, -((day + 6) % 7));
}

/** ISO-8601 week number (1–53) for the given date. */
export function isoWeekNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604800000);
}

/** Capitalise first letter (Intl weekday names come lower-cased in nb-NO). */
export function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** A `tel:` href with spaces/formatting stripped. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

/** Grammatically correct Norwegian "N lærer" / "N lærere". */
export function pluralTeachers(n: number): string {
  return `${n} ${n === 1 ? "lærer" : "lærere"}`;
}

/** Grammatically correct "N time" / "N timer". */
export function pluralLessons(n: number): string {
  return `${n} ${n === 1 ? "time" : "timer"}`;
}
