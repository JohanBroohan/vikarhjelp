"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import {
  PERIOD_COUNT,
  PERIOD_TIMES,
  WEEKDAY_ALIASES,
} from "@/lib/constants";
import type { ActionResult } from "./_common";

export interface ParsedRow {
  rowNumber: number;
  teacher_name: string;
  weekday: number | null;
  weekdayRaw: string;
  period: number | null;
  subject: string | null;
  class_group: string | null;
  room: string | null;
  error: string | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  /** Distinct teacher names found in the file that do NOT exist yet. */
  newTeacherNames: string[];
  /** Distinct teacher names found in the file that already exist. */
  existingTeacherNames: string[];
  validCount: number;
  errorCount: number;
}

// Map many possible header spellings (Norwegian + English) to our fields.
const HEADER_ALIASES: Record<string, keyof RowFields> = {
  teacher_name: "teacher_name", teacher: "teacher_name", laerer: "teacher_name",
  lærer: "teacher_name", larer: "teacher_name", navn: "teacher_name",
  lærernavn: "teacher_name", laerernavn: "teacher_name", name: "teacher_name",
  weekday: "weekday", ukedag: "weekday", dag: "weekday", day: "weekday",
  period: "period", time: "period", periode: "period", økt: "period",
  okt: "period", time_nr: "period", timenr: "period",
  subject: "subject", fag: "subject",
  class_group: "class_group", klasse: "class_group", class: "class_group",
  gruppe: "class_group", klassegruppe: "class_group",
  room: "room", rom: "room",
};

interface RowFields {
  teacher_name: string;
  weekday: string;
  period: string;
  subject: string;
  class_group: string;
  room: string;
}

function normalizeHeader(h: string): string {
  return String(h).trim().toLowerCase().replace(/[\s.]+/g, "_").replace(/_+/g, "_");
}

function cell(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/** Parse an uploaded .xlsx/.csv file into normalized, validated rows. */
export async function parseImport(formData: FormData): Promise<
  ActionResult<ParseResult>
> {
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

  if (table.length < 2) {
    return { ok: false, error: "Filen må ha en overskriftsrad og minst én datarad." };
  }

  // Build column index map from the header row.
  const headerRow = table[0].map(normalizeHeader);
  const colIndex: Partial<Record<keyof RowFields, number>> = {};
  headerRow.forEach((h, i) => {
    const field = HEADER_ALIASES[h];
    if (field && colIndex[field] === undefined) colIndex[field] = i;
  });

  if (colIndex.teacher_name === undefined) {
    return {
      ok: false,
      error:
        "Fant ikke kolonnen for lærernavn. Overskriften må inkludere f.eks. «teacher_name» eller «lærer».",
    };
  }

  const get = (row: string[], field: keyof RowFields): string => {
    const idx = colIndex[field];
    return idx === undefined ? "" : cell(row[idx]);
  };

  const rows: ParsedRow[] = [];
  for (let r = 1; r < table.length; r++) {
    const raw = table[r];
    const teacher_name = get(raw, "teacher_name");
    const weekdayRaw = get(raw, "weekday");
    const periodRaw = get(raw, "period");

    // Skip fully empty lines.
    if (!teacher_name && !weekdayRaw && !periodRaw) continue;

    const weekday = WEEKDAY_ALIASES[weekdayRaw.toLowerCase()] ?? null;
    const periodNum = Number.parseInt(periodRaw, 10);
    const period =
      Number.isFinite(periodNum) && periodNum >= 1 && periodNum <= PERIOD_COUNT
        ? periodNum
        : null;

    let error: string | null = null;
    if (!teacher_name) error = "Mangler lærernavn";
    else if (weekday === null) error = `Ugyldig ukedag: «${weekdayRaw}»`;
    else if (period === null) error = `Ugyldig time: «${periodRaw}»`;

    rows.push({
      rowNumber: r + 1,
      teacher_name,
      weekday,
      weekdayRaw,
      period,
      subject: get(raw, "subject") || null,
      class_group: get(raw, "class_group") || null,
      room: get(raw, "room") || null,
      error,
    });
  }

  // Which teacher names already exist?
  const supabase = await createClient();
  const { data: existing } = await supabase.from("teachers").select("name");
  const existingLower = new Set(
    (existing ?? []).map((t) => t.name.trim().toLowerCase()),
  );

  const distinctNames = [
    ...new Set(rows.filter((r) => r.teacher_name).map((r) => r.teacher_name)),
  ];
  const newTeacherNames = distinctNames.filter(
    (n) => !existingLower.has(n.toLowerCase()),
  );
  const existingTeacherNames = distinctNames.filter((n) =>
    existingLower.has(n.toLowerCase()),
  );

  return {
    ok: true,
    data: {
      rows,
      newTeacherNames,
      existingTeacherNames,
      validCount: rows.filter((r) => !r.error).length,
      errorCount: rows.filter((r) => r.error).length,
    },
  };
}

export interface CommitOptions {
  /** Create teachers that don't exist yet. */
  createMissingTeachers: boolean;
  /** Delete each affected teacher's existing lessons before inserting. */
  replaceExisting: boolean;
}

/** Write the validated rows to the database. */
export async function commitImport(
  rows: ParsedRow[],
  options: CommitOptions,
): Promise<ActionResult<{ inserted: number; createdTeachers: number }>> {
  await requireUser();
  const supabase = await createClient();

  const valid = rows.filter(
    (r) => !r.error && r.teacher_name && r.weekday && r.period,
  );
  if (valid.length === 0) {
    return { ok: false, error: "Ingen gyldige rader å importere." };
  }

  // Resolve teacher name -> id (case-insensitive).
  const { data: teachers } = await supabase.from("teachers").select("id, name");
  const idByName = new Map<string, string>();
  for (const t of teachers ?? []) idByName.set(t.name.trim().toLowerCase(), t.id);

  const distinctNames = [...new Set(valid.map((r) => r.teacher_name))];
  const missing = distinctNames.filter((n) => !idByName.has(n.toLowerCase()));

  let createdTeachers = 0;
  if (missing.length > 0) {
    if (!options.createMissingTeachers) {
      return {
        ok: false,
        error:
          "Noen lærere finnes ikke. Huk av for å opprette dem, eller fjern radene.",
      };
    }
    const { data: inserted, error } = await supabase
      .from("teachers")
      .insert(missing.map((name) => ({ name })))
      .select("id, name");
    if (error) return { ok: false, error: error.message };
    for (const t of inserted ?? []) idByName.set(t.name.trim().toLowerCase(), t.id);
    createdTeachers = inserted?.length ?? 0;
  }

  const affectedTeacherIds = [
    ...new Set(distinctNames.map((n) => idByName.get(n.toLowerCase())!).filter(Boolean)),
  ];

  if (options.replaceExisting && affectedTeacherIds.length > 0) {
    const { error } = await supabase
      .from("lessons")
      .delete()
      .in("teacher_id", affectedTeacherIds);
    if (error) return { ok: false, error: error.message };
  }

  const lessonRows = valid.map((r) => ({
    teacher_id: idByName.get(r.teacher_name.toLowerCase())!,
    weekday: r.weekday!,
    period: r.period!,
    subject: r.subject,
    class_group: r.class_group,
    room: r.room,
    start_time: PERIOD_TIMES[r.period!]?.start ?? null,
    end_time: PERIOD_TIMES[r.period!]?.end ?? null,
  }));

  // Upsert so a re-run (without replace) updates a slot instead of erroring on
  // the unique (teacher_id, weekday, period) constraint.
  const { error: insErr } = await supabase
    .from("lessons")
    .upsert(lessonRows, { onConflict: "teacher_id,weekday,period" });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/laerere");
  revalidatePath("/timeplan");
  revalidatePath("/");

  return { ok: true, data: { inserted: lessonRows.length, createdTeachers } };
}
