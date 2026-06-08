// Date-range helpers for the Ekstratimer reports. Pure string math on ISO
// dates (YYYY-MM-DD), anchored to a "today" the caller supplies.

export type RangePreset = "week" | "month" | "all" | "custom";

export interface DateRange {
  preset: RangePreset;
  from: string | null; // inclusive ISO date, null = open
  to: string | null; // inclusive ISO date, null = open
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `iso`. */
function startOfWeekISO(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const offsetToMonday = (day + 6) % 7;
  return addDaysISO(iso, -offsetToMonday);
}

function monthBounds(iso: string): { from: string; to: string } {
  const [y, m] = iso.split("-").map(Number);
  const from = `${iso.slice(0, 7)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${iso.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

/** Resolve a range from URL params, relative to `today`. */
export function resolveRange(
  params: { preset?: string; from?: string; to?: string },
  today: string,
): DateRange {
  const preset = (params.preset as RangePreset) || "month";
  switch (preset) {
    case "week": {
      const from = startOfWeekISO(today);
      return { preset, from, to: addDaysISO(from, 6) };
    }
    case "all":
      return { preset, from: null, to: null };
    case "custom":
      return {
        preset,
        from: params.from || null,
        to: params.to || null,
      };
    case "month":
    default: {
      const { from, to } = monthBounds(today);
      return { preset: "month", from, to };
    }
  }
}

/** Encode a range back into a query string (for links / export). */
export function rangeToQuery(range: DateRange): string {
  const p = new URLSearchParams();
  p.set("preset", range.preset);
  if (range.preset === "custom") {
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
  }
  return p.toString();
}

export const RANGE_LABELS: Record<RangePreset, string> = {
  week: "Denne uka",
  month: "Denne måneden",
  all: "Hele tiden",
  custom: "Egendefinert",
};
