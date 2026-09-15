// Pure timetable-grid parsing, with no server/database dependencies so it can
// be unit-tested directly. `parseTeacherGrid` (the server action) reads the
// uploaded file into a buffer and delegates here.
import * as XLSX from "xlsx";
import {
  WEEKDAY_ALIASES,
  WEEKDAY_NAMES,
  PERIOD_BY_START,
  inferActivityType,
  lessonIsClass,
} from "../constants";
import type { ActionResult } from "../actions/_common";

export interface GridEntry {
  weekday: number;
  weekdayLabel: string;
  period: number;
  start: string;
  end: string;
  subject: string | null;
  classGroup: string | null;
  /** Explicit session type (see ACTIVITY_TYPES), pre-filled by inference. */
  activityType: string;
  isClass: boolean;
  raw: string;
}

export interface GridParseResult {
  /** Detected teacher name (null if only a placeholder "X" was present). */
  teacherName: string | null;
  entries: GridEntry[];
  classCount: number;
  otherCount: number;
}

/** Normalize a single time token to "HH:MM". Accepts 8:30, 08:30, 0830, 8.30. */
function normTime(tok: string): string | null {
  const m = tok.match(/^(\d{1,2})[:.]?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

const TIME_TOKEN = String.raw`\d{1,2}[:.]?\d{2}`;

/** Parse a time range anywhere in the text (used for a «Tid» column cell). */
function parseTimeRange(s: string): { start: string; end: string } | null {
  const m = s.match(new RegExp(`(${TIME_TOKEN})\\s*(?:[-–—]|til)\\s*(${TIME_TOKEN})`, "i"));
  if (!m) return null;
  const start = normTime(m[1]);
  const end = normTime(m[2]);
  return start && end ? { start, end } : null;
}

/** Parse a leading "HH:MM-HH:MM" range and return the remaining text after it. */
function parseLeadingRange(
  text: string,
): { start: string; end: string; rest: string } | null {
  const m = text.match(
    new RegExp(`^\\s*(${TIME_TOKEN})\\s*(?:[-–—]|til)\\s*(${TIME_TOKEN})`, "i"),
  );
  if (!m) return null;
  const start = normTime(m[1]);
  const end = normTime(m[2]);
  if (!start || !end) return null;
  return { start, end, rest: text.slice(m[0].length).replace(/^[\s:–—-]+/, "").trim() };
}

/** Split "Matematikk 10. trinn" -> subject "Matematikk", classGroup "10. trinn". */
function splitSubject(text: string): { subject: string; classGroup: string | null } {
  const m = text.match(/(\d+\.?(?:\s*[-–—]\s*\d+\.?)?\s*trinn)/i);
  if (m && m.index != null) {
    const classGroup = m[1].replace(/\s+/g, " ").trim();
    const subject = text.slice(0, m.index).trim();
    return { subject: subject || text.trim(), classGroup };
  }
  return { subject: text.trim(), classGroup: null };
}

const cell = (v: unknown) => (v == null ? "" : String(v).trim());

/**
 * Parse an already-read sheet (rows of string cells) into timetable entries.
 * Auto-detects the two layouts we see in the wild:
 *  - per-cell: each weekday cell starts with its own "HH:MM-HH:MM …" range
 *  - tid-column: a shared time per row (explicit «Tid» header, or a time
 *    column just left of the weekdays).
 */
export function parseGridTable(table: string[][]): ActionResult<GridParseResult> {
  // Find the header row (naming the weekdays) and map columns. We only require
  // the weekday row here — time info can be in a «Tid» column or in each cell.
  let headerRow = -1;
  let weekdayCols: { col: number; weekday: number }[] = [];
  let explicitTidCol = -1;
  for (let r = 0; r < table.length; r++) {
    const cols: { col: number; weekday: number }[] = [];
    let foundTid = -1;
    (table[r] ?? []).forEach((raw, c) => {
      const v = cell(raw).toLowerCase();
      if (WEEKDAY_ALIASES[v] && WEEKDAY_ALIASES[v] >= 1 && WEEKDAY_ALIASES[v] <= 5) {
        cols.push({ col: c, weekday: WEEKDAY_ALIASES[v] });
      }
      if (v === "tid" || v === "time" || v === "klokkeslett") foundTid = c;
    });
    if (cols.length >= 3) {
      headerRow = r;
      weekdayCols = cols;
      explicitTidCol = foundTid;
      break;
    }
  }

  if (headerRow === -1) {
    return {
      ok: false,
      error:
        "Fant ikke timeplanen. Filen må ha en rad med ukedagene (Mandag, Tirsdag …).",
    };
  }

  const dataRows = table.slice(headerRow + 1);

  // Decide where the times come from. Prefer an explicit «Tid» column; else a
  // column just left of the weekdays that holds time ranges. Independently,
  // measure how many weekday cells begin with their own time range.
  let tidCol = explicitTidCol;
  if (tidCol < 0) {
    const leftCol = Math.min(...weekdayCols.map((x) => x.col)) - 1;
    if (leftCol >= 0) {
      const timeRowsInLeft = dataRows.filter(
        (row) => parseTimeRange(cell(row[leftCol])) != null,
      ).length;
      if (timeRowsInLeft >= 2) tidCol = leftCol;
    }
  }

  let filledCells = 0;
  let leadingTimeCells = 0;
  for (const row of dataRows) {
    for (const { col } of weekdayCols) {
      const raw = cell(row[col]);
      if (!raw) continue;
      filledCells++;
      if (parseLeadingRange(raw)) leadingTimeCells++;
    }
  }
  const perCellMode =
    filledCells > 0 &&
    (leadingTimeCells / filledCells >= 0.5 ||
      (tidCol < 0 && leadingTimeCells > 0));

  if (!perCellMode && tidCol < 0) {
    return {
      ok: false,
      error:
        "Fant ingen klokkeslett i timeplanen. Hver time må ha et tidspunkt " +
        "— enten i en «Tid»-kolonne eller først i hver celle (f.eks. «08:15-09:00 Matematikk»).",
    };
  }

  // Teacher name: first a "Timeplan for …" cell, else a lone label above the
  // grid that isn't a weekday, a time or the «Tid» header.
  let teacherName: string | null = null;
  for (let r = 0; r <= headerRow && !teacherName; r++) {
    for (const raw of table[r] ?? []) {
      const m = cell(raw).match(/timeplan\s+for\s+(.+)/i);
      if (m) {
        const name = m[1].trim().replace(/[:.]$/, "").trim();
        if (name && name.toLowerCase() !== "x") {
          teacherName = name;
          break;
        }
      }
    }
  }
  if (!teacherName) {
    for (let r = 0; r < headerRow; r++) {
      for (const raw of table[r] ?? []) {
        const v = cell(raw);
        const lower = v.toLowerCase();
        const isNoise =
          !v ||
          lower.includes("timeplan") ||
          WEEKDAY_ALIASES[lower] != null ||
          ["tid", "time", "klokkeslett"].includes(lower) ||
          parseTimeRange(v) != null ||
          /^\d+[.:]?\d*$/.test(v);
        if (!isNoise) {
          teacherName = v;
          break;
        }
      }
      if (teacherName) break;
    }
  }

  const entries: GridEntry[] = [];

  if (perCellMode) {
    // Each weekday cell carries its own "HH:MM-HH:MM …" time. Build one entry
    // per cell, sort by weekday+start, and give every entry a globally-unique
    // period so the editable preview can key each cell's time independently.
    const cells: {
      weekday: number;
      start: string;
      end: string;
      raw: string;
    }[] = [];
    for (const row of dataRows) {
      for (const { col, weekday } of weekdayCols) {
        const raw = cell(row[col]);
        if (!raw) continue;
        const led = parseLeadingRange(raw);
        if (!led) continue; // no time on this cell → can't place it
        cells.push({ weekday, start: led.start, end: led.end, raw: led.rest || raw });
      }
    }
    if (cells.length === 0) {
      return { ok: false, error: "Fant ingen timer i rutenettet." };
    }
    cells.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
    cells.forEach((c, i) => {
      const { subject, classGroup } = splitSubject(c.raw);
      const at = inferActivityType(subject);
      entries.push({
        weekday: c.weekday,
        weekdayLabel: WEEKDAY_NAMES[c.weekday],
        period: i + 1,
        start: c.start,
        end: c.end,
        subject,
        classGroup,
        activityType: at,
        isClass: lessonIsClass({ subject, activity_type: at }),
        raw: c.raw,
      });
    });
  } else {
    // Shared «Tid» column: one time per row, applied to every weekday cell.
    const timeRows: {
      start: string;
      end: string;
      cells: { weekday: number; raw: string }[];
    }[] = [];
    for (const row of dataRows) {
      const tidRaw = cell(row[tidCol]);
      if (!tidRaw) continue;
      const range = parseTimeRange(tidRaw);
      if (!range) continue; // not a time row (could be a spacer)
      const rowCells: { weekday: number; raw: string }[] = [];
      for (const { col, weekday } of weekdayCols) {
        const raw = cell(row[col]);
        if (raw) rowCells.push({ weekday, raw });
      }
      timeRows.push({ start: range.start, end: range.end, cells: rowCells });
    }

    if (timeRows.length === 0) {
      return { ok: false, error: "Fant ingen timer i rutenettet." };
    }

    // Assign each row a `period`. If every row lines up with the school's
    // canonical bell times, keep those numbers so standard schools stay
    // aligned. Otherwise number the rows 1..N in time order, so any other bell
    // schedule imports cleanly instead of colliding on (teacher, weekday, period).
    const allMatchKnownSlots = timeRows.every(
      (row) => PERIOD_BY_START[row.start] !== undefined,
    );
    timeRows.forEach((row, i) => {
      const period = allMatchKnownSlots ? PERIOD_BY_START[row.start] : i + 1;
      for (const { weekday, raw } of row.cells) {
        const { subject, classGroup } = splitSubject(raw);
        const at = inferActivityType(subject);
        entries.push({
          weekday,
          weekdayLabel: WEEKDAY_NAMES[weekday],
          period,
          start: row.start,
          end: row.end,
          subject,
          classGroup,
          activityType: at,
          isClass: lessonIsClass({ subject, activity_type: at }),
          raw,
        });
      }
    });
  }

  if (entries.length === 0) {
    return { ok: false, error: "Fant ingen timer i rutenettet." };
  }

  entries.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));

  return {
    ok: true,
    data: {
      teacherName,
      entries,
      classCount: entries.filter((e) => e.isClass).length,
      otherCount: entries.filter((e) => !e.isClass).length,
    },
  };
}

/** Read an uploaded .xlsx/.csv buffer and parse its first sheet as a grid. */
export function parseGridBuffer(
  buf: Buffer | ArrayBuffer | Uint8Array,
): ActionResult<GridParseResult> {
  let table: string[][];
  try {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { ok: false, error: "Fant ingen ark i filen." };
    table = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
  } catch {
    return { ok: false, error: "Klarte ikke å lese filen. Er det en gyldig .xlsx eller .csv?" };
  }
  return parseGridTable(table);
}
