"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import {
  computeCoveragePlan,
  weekdayFromISODate,
  type LessonCoverage,
} from "@/lib/coverage";
import type {
  Absence,
  CoverageAssignment,
  Lesson,
  Teacher,
  Vikar,
} from "@/lib/database.types";
import {
  ABSENCE_TYPES,
  DEFAULT_ABSENCE_TYPE,
  SCHOOL_DAY_START,
  SCHOOL_DAY_END,
  isClassActivity,
  lessonInWindow,
  type CoverageStatus,
} from "@/lib/constants";
import type { ActionResult } from "./_common";
import { nullableText } from "./_common";

/* -------------------------------------------------------------------------- */
/* Report-absence flow: load + save                                           */
/* -------------------------------------------------------------------------- */

export type DecisionKind =
  | "pending"
  | "teacher"
  | "vikar"
  | "coteacher"
  | "uncovered";

export interface LessonDecision {
  lessonId: string;
  kind: DecisionKind;
  coveringTeacherId?: string | null;
  coveringVikarId?: string | null;
  notes?: string | null;
}

export interface ReportData {
  weekday: number | null;
  lessons: LessonCoverage[];
  vikars: Vikar[];
  /** id -> teacher, for resolving co-teacher + covering names client-side. */
  teachersById: Record<string, Teacher>;
  /** Existing decisions when re-opening a date (lessonId -> decision). */
  existing: Record<string, LessonDecision>;
  /** Saved absence window when re-opening (null = whole day / new absence). */
  absenceWindow: { from: string; to: string } | null;
  /** Saved absence type slug (defaults to egenmelding for a new absence). */
  absenceType: string;
}

/**
 * Gather everything the report-absence screen needs and run the coverage
 * engine. Pure logic lives in lib/coverage.ts; this just fetches + assembles.
 */
export async function loadReportData(
  date: string,
  absentTeacherId: string,
): Promise<ActionResult<ReportData>> {
  await requireUser();
  const supabase = await createClient();

  const [teachersRes, lessonsRes, absencesRes, assignmentsRes, vikarsRes] =
    await Promise.all([
      supabase.from("teachers").select("*"),
      supabase.from("lessons").select("*"),
      supabase.from("absences").select("*").eq("date", date),
      supabase.from("coverage_assignments").select("*"),
      supabase.from("vikars").select("*").eq("is_active", true).order("name"),
    ]);

  const teachers = (teachersRes.data ?? []) as Teacher[];
  const allLessons = (lessonsRes.data ?? []) as Lesson[];
  const absences = (absencesRes.data ?? []) as Absence[];
  const assignments = (assignmentsRes.data ?? []) as CoverageAssignment[];
  const vikars = (vikarsRes.data ?? []) as Vikar[];

  const { weekday, lessons } = computeCoveragePlan({
    date,
    absentTeacherId,
    teachers,
    allLessons,
    absences,
    assignments,
  });

  // Only offer vikars who are available on this weekday.
  const availableVikars =
    weekday == null
      ? vikars
      : vikars.filter((v) => !(v.unavailable_weekdays ?? []).includes(weekday));

  const teachersById: Record<string, Teacher> = {};
  for (const t of teachers) teachersById[t.id] = t;

  // Prefill from any assignments already saved for this date + teacher.
  const existing: Record<string, LessonDecision> = {};
  for (const a of assignments) {
    if (a.date !== date || a.absent_teacher_id !== absentTeacherId) continue;
    existing[a.lesson_id] = {
      lessonId: a.lesson_id,
      kind: statusToKind(a.status),
      coveringTeacherId: a.covering_teacher_id,
      coveringVikarId: a.covering_vikar_id,
      notes: a.notes,
    };
  }

  // Saved time window / type for this absence (if already reported).
  const absenceRow = absences.find((a) => a.teacher_id === absentTeacherId);
  const absenceWindow =
    absenceRow?.start_time && absenceRow?.end_time
      ? { from: absenceRow.start_time, to: absenceRow.end_time }
      : null;
  const absenceType = absenceRow?.absence_type ?? DEFAULT_ABSENCE_TYPE;

  return {
    ok: true,
    data: {
      weekday,
      lessons,
      vikars: availableVikars,
      teachersById,
      existing,
      absenceWindow,
      absenceType,
    },
  };
}

function statusToKind(status: CoverageStatus): DecisionKind {
  switch (status) {
    case "covered_by_teacher":
      return "teacher";
    case "covered_by_vikar":
      return "vikar";
    case "covered_by_coteacher":
      return "coteacher";
    case "uncovered":
      return "uncovered";
    default:
      return "pending";
  }
}

function kindToStatus(d: LessonDecision): CoverageStatus {
  switch (d.kind) {
    case "teacher":
      return "covered_by_teacher";
    case "vikar":
      return "covered_by_vikar";
    case "coteacher":
      return "covered_by_coteacher";
    case "uncovered":
      return "uncovered";
    default:
      return "pending";
  }
}

export interface SaveCoverageInput {
  date: string;
  absentTeacherId: string;
  reason?: string | null;
  /** Absence type slug (see ABSENCE_TYPES). */
  absenceType?: string;
  /** Partial-day window; null = whole day. */
  window?: { from: string; to: string } | null;
  /** Decisions for the in-scope lessons only (others get pruned). */
  decisions: LessonDecision[];
}

/**
 * Persist an absence and its per-lesson coverage decisions. Idempotent:
 * re-opening a date and saving again UPDATES existing assignment rows (keeping
 * their settled state) instead of creating duplicates.
 */
export async function saveCoverage(
  input: SaveCoverageInput,
): Promise<ActionResult> {
  await requireUser();
  if (weekdayFromISODate(input.date) == null) {
    return { ok: false, error: "Valgt dato er i helgen — ingen timer å dekke." };
  }
  const supabase = await createClient();

  // Pull the periods of the decided lessons to validate double-booking.
  const lessonIds = input.decisions.map((d) => d.lessonId);
  const { data: decidedLessons } = await supabase
    .from("lessons")
    .select("id, period")
    .in("id", lessonIds.length ? lessonIds : ["00000000-0000-0000-0000-000000000000"]);
  const periodByLesson = new Map<string, number>(
    (decidedLessons ?? []).map((l) => [l.id, l.period]),
  );

  // A covering teacher must not be assigned to two lessons in the same period.
  const seen = new Map<string, string>(); // `${teacherId}:${period}` -> lessonId
  for (const d of input.decisions) {
    if (d.kind !== "teacher" || !d.coveringTeacherId) continue;
    const period = periodByLesson.get(d.lessonId);
    if (period == null) continue;
    const key = `${d.coveringTeacherId}:${period}`;
    if (seen.has(key)) {
      return {
        ok: false,
        error:
          "Samme lærer er satt opp to ganger i samme time. Velg en annen vikar for én av timene.",
      };
    }
    seen.set(key, d.lessonId);
  }

  // Validate the absence type against the known list; fall back to the default.
  const absenceType = ABSENCE_TYPES.some((t) => t.value === input.absenceType)
    ? input.absenceType!
    : DEFAULT_ABSENCE_TYPE;

  // Upsert the absence (one row per teacher per date), incl. the time window.
  const { error: absErr } = await supabase
    .from("absences")
    .upsert(
      {
        teacher_id: input.absentTeacherId,
        date: input.date,
        reason: nullableText(input.reason),
        absence_type: absenceType,
        start_time: input.window?.from ?? null,
        end_time: input.window?.to ?? null,
      },
      { onConflict: "teacher_id,date" },
    );
  if (absErr) return { ok: false, error: absErr.message };

  // Load existing assignments for this date+teacher so we update rather than
  // duplicate, and preserve settled state.
  const { data: existingRows } = await supabase
    .from("coverage_assignments")
    .select("id, lesson_id")
    .eq("date", input.date)
    .eq("absent_teacher_id", input.absentTeacherId);
  const existingByLesson = new Map<string, string>(
    (existingRows ?? []).map((r) => [r.lesson_id, r.id]),
  );

  // Prune assignments for lessons no longer in scope (e.g. the window was
  // narrowed so some lessons fell outside it).
  const submittedLessonIds = new Set(input.decisions.map((d) => d.lessonId));
  const toDelete = (existingRows ?? [])
    .filter((r) => !submittedLessonIds.has(r.lesson_id))
    .map((r) => r.id);
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("coverage_assignments")
      .delete()
      .in("id", toDelete);
    if (delErr) return { ok: false, error: delErr.message };
  }

  for (const d of input.decisions) {
    const status = kindToStatus(d);
    const row = {
      date: input.date,
      lesson_id: d.lessonId,
      absent_teacher_id: input.absentTeacherId,
      covering_teacher_id: d.kind === "teacher" ? d.coveringTeacherId ?? null : null,
      covering_vikar_id: d.kind === "vikar" ? d.coveringVikarId ?? null : null,
      status,
      notes: nullableText(d.notes),
    };
    const existingId = existingByLesson.get(d.lessonId);
    const { error } = existingId
      ? await supabase.from("coverage_assignments").update(row).eq("id", existingId)
      : await supabase.from("coverage_assignments").insert(row);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/fravaer");
  revalidatePath("/ekstratimer");
  return { ok: true };
}

/** Remove an absence and all its coverage assignments for a date. */
export async function deleteAbsence(
  absentTeacherId: string,
  date: string,
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const { error: covErr } = await supabase
    .from("coverage_assignments")
    .delete()
    .eq("date", date)
    .eq("absent_teacher_id", absentTeacherId);
  if (covErr) return { ok: false, error: covErr.message };

  const { error: absErr } = await supabase
    .from("absences")
    .delete()
    .eq("date", date)
    .eq("teacher_id", absentTeacherId);
  if (absErr) return { ok: false, error: absErr.message };

  revalidatePath("/");
  revalidatePath("/fravaer");
  revalidatePath("/ekstratimer");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Multi-day absence registration                                            */
/* -------------------------------------------------------------------------- */

export interface MultiDayAbsenceInput {
  teacherId: string;
  absenceType?: string;
  fromDate: string;
  fromTime?: string | null;
  toDate: string;
  toTime?: string | null;
}

/**
 * Register an absence spanning several days. Creates one absence row per
 * weekday in the range (first day from `fromTime`, last day to `toTime`, middle
 * days whole) and a `pending` coverage assignment for each class lesson so the
 * day shows as "udekket" until the principal assigns covers day-by-day.
 * Existing (already-assigned) covers are left untouched.
 */
export async function registerMultiDayAbsence(
  input: MultiDayAbsenceInput,
): Promise<ActionResult<{ days: number; lessons: number }>> {
  await requireUser();
  if (input.toDate < input.fromDate) {
    return { ok: false, error: "Til-dato må være lik eller etter fra-dato." };
  }
  const supabase = await createClient();

  const absenceType = ABSENCE_TYPES.some((t) => t.value === input.absenceType)
    ? input.absenceType!
    : DEFAULT_ABSENCE_TYPE;

  const { data: lessonsData } = await supabase
    .from("lessons")
    .select("*")
    .eq("teacher_id", input.teacherId);
  const teacherLessons = (lessonsData ?? []) as Lesson[];

  let days = 0;
  let lessons = 0;

  for (let d = input.fromDate; d <= input.toDate; d = addWeekDays(d, 1)) {
    const weekday = weekdayFromISODate(d);
    if (weekday == null) continue; // skip weekends

    const start = d === input.fromDate && input.fromTime ? input.fromTime : SCHOOL_DAY_START;
    const end = d === input.toDate && input.toTime ? input.toTime : SCHOOL_DAY_END;
    const isWhole = start <= SCHOOL_DAY_START && end >= SCHOOL_DAY_END;
    const window = isWhole ? null : { from: start, to: end };

    const { error: absErr } = await supabase.from("absences").upsert(
      {
        teacher_id: input.teacherId,
        date: d,
        absence_type: absenceType,
        start_time: window?.from ?? null,
        end_time: window?.to ?? null,
      },
      { onConflict: "teacher_id,date" },
    );
    if (absErr) return { ok: false, error: absErr.message };
    days += 1;

    // The teacher's class lessons that day, within the window.
    const dayLessons = teacherLessons.filter(
      (l) =>
        l.weekday === weekday &&
        isClassActivity(l.subject) &&
        lessonInWindow(l, window),
    );
    const dayLessonIds = new Set(dayLessons.map((l) => l.id));

    const { data: existing } = await supabase
      .from("coverage_assignments")
      .select("id, lesson_id")
      .eq("date", d)
      .eq("absent_teacher_id", input.teacherId);
    const existingByLesson = new Map((existing ?? []).map((r) => [r.lesson_id, r.id]));

    // Drop any assignments now out of the window.
    const toDelete = (existing ?? [])
      .filter((r) => !dayLessonIds.has(r.lesson_id))
      .map((r) => r.id);
    if (toDelete.length > 0) {
      await supabase.from("coverage_assignments").delete().in("id", toDelete);
    }

    // Add a pending assignment for each not-yet-tracked class lesson.
    for (const l of dayLessons) {
      if (existingByLesson.has(l.id)) continue; // keep existing cover as-is
      const { error } = await supabase.from("coverage_assignments").insert({
        date: d,
        lesson_id: l.id,
        absent_teacher_id: input.teacherId,
        covering_teacher_id: null,
        covering_vikar_id: null,
        status: "pending",
        notes: null,
      });
      if (error) return { ok: false, error: error.message };
      lessons += 1;
    }
  }

  revalidatePath("/");
  revalidatePath("/fravaer");
  revalidatePath("/ekstratimer");
  return { ok: true, data: { days, lessons } };
}

/* -------------------------------------------------------------------------- */
/* Timeplan week overlay                                                      */
/* -------------------------------------------------------------------------- */

export interface WeekCoverageCell {
  status: CoverageStatus;
  coveringName: string | null;
  absentName: string;
}

/**
 * Coverage overlay for one week, keyed by lesson_id. Each lesson sits on a
 * fixed weekday, so within a single week it maps to exactly one date and thus
 * at most one coverage assignment.
 */
export async function getWeekOverlay(
  weekStartISO: string,
): Promise<Record<string, WeekCoverageCell>> {
  await requireUser();
  const supabase = await createClient();
  const from = weekStartISO;
  const to = addWeekDays(weekStartISO, 4); // Mon..Fri

  const [assignsRes, teachersRes, vikarsRes] = await Promise.all([
    supabase
      .from("coverage_assignments")
      .select("*")
      .gte("date", from)
      .lte("date", to),
    supabase.from("teachers").select("id, name"),
    supabase.from("vikars").select("id, name"),
  ]);

  const tName = new Map((teachersRes.data ?? []).map((t) => [t.id, t.name as string]));
  const vName = new Map((vikarsRes.data ?? []).map((v) => [v.id, v.name as string]));

  const overlay: Record<string, WeekCoverageCell> = {};
  for (const a of (assignsRes.data ?? []) as CoverageAssignment[]) {
    const coveringName = a.covering_teacher_id
      ? tName.get(a.covering_teacher_id) ?? null
      : a.covering_vikar_id
        ? vName.get(a.covering_vikar_id) ?? null
        : null;
    overlay[a.lesson_id] = {
      status: a.status,
      coveringName,
      absentName: tName.get(a.absent_teacher_id) ?? "Ukjent",
    };
  }
  return overlay;
}

/** Local day-add helper (avoids importing the client format module here). */
function addWeekDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

