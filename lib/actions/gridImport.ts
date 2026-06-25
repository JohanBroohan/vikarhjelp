"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import {
  WEEKDAY_ALIASES,
  WEEKDAY_NAMES,
  PERIOD_BY_START,
  isClassActivity,
} from "@/lib/constants";
import type { ActionResult } from "./_common";

export interface GridEntry {
  weekday: number;
  weekdayLabel: string;
  period: number;
  start: string;
  end: string;
  subject: string | null;
  classGroup: string | null;
  isClass: boolean;
  raw: string;
}

export interface GridParseResult {
  /** Detected teacher name from "Timeplan for …" (null if placeholder "X"). */
  teacherName: string | null;
  entries: GridEntry[];
  classCount: number;
  otherCount: number;
  /** Time ranges in the file that didn't match a known slot (informational). */
  unmatchedTimes: string[];
}

function pad(hm: string): string {
  const [h, m] = hm.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

function parseTimeRange(s: string): { start: string; end: string } | null {
  const m = s.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  return m ? { start: pad(m[1]), end: pad(m[2]) } : null;
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

/** Parse an exported per-teacher timetable grid (.xlsx/.csv). */
export async function parseTeacherGrid(
  formData: FormData,
): Promise<ActionResult<GridParseResult>> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Ingen fil ble lastet opp." };
  }

  let table: string[][];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
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

  const cell = (v: unknown) => (v == null ? "" : String(v).trim());

  // Find the header row (the one naming the weekdays) and map columns.
  let headerRow = -1;
  let weekdayCols: { col: number; weekday: number }[] = [];
  let tidCol = -1;
  for (let r = 0; r < table.length; r++) {
    const cols: { col: number; weekday: number }[] = [];
    let foundTid = -1;
    table[r].forEach((raw, c) => {
      const v = cell(raw).toLowerCase();
      if (WEEKDAY_ALIASES[v] && WEEKDAY_ALIASES[v] >= 1 && WEEKDAY_ALIASES[v] <= 5) {
        cols.push({ col: c, weekday: WEEKDAY_ALIASES[v] });
      }
      if (v === "tid" || v === "time" || v === "klokkeslett") foundTid = c;
    });
    if (cols.length >= 3) {
      headerRow = r;
      weekdayCols = cols;
      tidCol = foundTid >= 0 ? foundTid : Math.min(...cols.map((x) => x.col)) - 1;
      break;
    }
  }

  if (headerRow === -1 || tidCol < 0) {
    return {
      ok: false,
      error:
        "Fant ikke timeplan-rutenettet. Filen må ha en rad med ukedagene (Mandag, Tirsdag …) og en «Tid»-kolonne.",
    };
  }

  // Teacher name from a "Timeplan for …" cell above the header.
  let teacherName: string | null = null;
  for (let r = 0; r <= headerRow; r++) {
    for (const raw of table[r]) {
      const m = cell(raw).match(/timeplan\s+for\s+(.+)/i);
      if (m) {
        const name = m[1].trim().replace(/[:.]$/, "").trim();
        if (name && name.toLowerCase() !== "x") teacherName = name;
      }
    }
  }

  const entries: GridEntry[] = [];
  const unmatched = new Set<string>();
  let seq = 0;

  for (let r = headerRow + 1; r < table.length; r++) {
    const tidRaw = cell(table[r][tidCol]);
    if (!tidRaw) continue;
    const range = parseTimeRange(tidRaw);
    if (!range) continue; // not a time row (could be a spacer)
    seq += 1;
    const period = PERIOD_BY_START[range.start] ?? seq;
    if (PERIOD_BY_START[range.start] === undefined) {
      unmatched.add(`${range.start}–${range.end}`);
    }

    for (const { col, weekday } of weekdayCols) {
      const raw = cell(table[r][col]);
      if (!raw) continue;
      const { subject, classGroup } = splitSubject(raw);
      entries.push({
        weekday,
        weekdayLabel: WEEKDAY_NAMES[weekday],
        period,
        start: range.start,
        end: range.end,
        subject,
        classGroup,
        isClass: isClassActivity(subject),
        raw,
      });
    }
  }

  if (entries.length === 0) {
    return { ok: false, error: "Fant ingen timer i rutenettet." };
  }

  entries.sort((a, b) => a.weekday - b.weekday || a.period - b.period);

  return {
    ok: true,
    data: {
      teacherName,
      entries,
      classCount: entries.filter((e) => e.isClass).length,
      otherCount: entries.filter((e) => !e.isClass).length,
      unmatchedTimes: [...unmatched],
    },
  };
}

export interface CommitGridInput {
  /** Existing teacher to assign this schedule to … */
  teacherId?: string;
  /** … or a new teacher name to create. */
  newTeacherName?: string;
  entries: GridEntry[];
}

/** Replace one teacher's whole weekly schedule with the parsed grid. */
export async function commitTeacherGrid(
  input: CommitGridInput,
): Promise<ActionResult<{ teacherId: string; inserted: number; created: boolean }>> {
  await requireUser();
  const supabase = await createClient();

  let teacherId = input.teacherId;
  let created = false;
  if (!teacherId) {
    const name = input.newTeacherName?.trim();
    if (!name) return { ok: false, error: "Velg en lærer eller skriv inn et navn." };
    const { data, error } = await supabase
      .from("teachers")
      .insert({ name })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    teacherId = data!.id;
    created = true;
  }

  // Replace: clear this teacher's existing lessons, then insert the grid.
  const { error: delErr } = await supabase
    .from("lessons")
    .delete()
    .eq("teacher_id", teacherId);
  if (delErr) return { ok: false, error: delErr.message };

  const rows = input.entries.map((e) => ({
    teacher_id: teacherId!,
    weekday: e.weekday,
    period: e.period,
    start_time: e.start,
    end_time: e.end,
    subject: e.subject,
    class_group: e.classGroup,
    room: null,
  }));
  const { error: insErr } = await supabase
    .from("lessons")
    .upsert(rows, { onConflict: "teacher_id,weekday,period" });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/laerere");
  revalidatePath("/timeplan");
  revalidatePath("/");
  return { ok: true, data: { teacherId: teacherId!, inserted: rows.length, created } };
}
