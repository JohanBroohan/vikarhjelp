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
