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
import { lessonInWindow, type CoverageStatus } from "@/lib/constants";
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

  // Saved time window for this absence (if it was reported partial-day).
  const absenceRow = absences.find((a) => a.teacher_id === absentTeacherId);
  const absenceWindow =
    absenceRow?.start_time && absenceRow?.end_time
      ? { from: absenceRow.start_time, to: absenceRow.end_time }
      : null;

  return {
    ok: true,
    data: { weekday, lessons, vikars: availableVikars, teachersById, existing, absenceWindow },
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

  // Upsert the absence (one row per teacher per date), incl. the time window.
  const { error: absErr } = await supabase
    .from("absences")
    .upsert(
      {
        teacher_id: input.absentTeacherId,
        date: input.date,
        reason: nullableText(input.reason),
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
/* Dashboard overview                                                         */
/* -------------------------------------------------------------------------- */

export interface DayLesson {
  assignment: CoverageAssignment | null;
  lesson: Lesson;
  coveringName: string | null;
  status: CoverageStatus;
}

export interface DayAbsence {
  teacher: Teacher;
  reason: string | null;
  /** Partial-day window, or null for a whole-day absence. */
  window: { from: string; to: string } | null;
  lessons: DayLesson[];
}

export interface DayOverview {
  date: string;
  weekday: number | null;
  absences: DayAbsence[];
  summary: { total: number; covered: number; pending: number; uncovered: number };
}

/** Assemble the "I dag" dashboard data for a given date. */
export async function getDayOverview(date: string): Promise<DayOverview> {
  const supabase = await createClient();
  const weekday = weekdayFromISODate(date);

  const [teachersRes, vikarsRes, absencesRes, lessonsRes, assignmentsRes] =
    await Promise.all([
      supabase.from("teachers").select("*"),
      supabase.from("vikars").select("id, name"),
      supabase.from("absences").select("*").eq("date", date),
      supabase.from("lessons").select("*"),
      supabase.from("coverage_assignments").select("*").eq("date", date),
    ]);

  const teachers = (teachersRes.data ?? []) as Teacher[];
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const vikarById = new Map(
    (vikarsRes.data ?? []).map((v) => [v.id, v.name as string]),
  );
  const absences = (absencesRes.data ?? []) as Absence[];
  const allLessons = (lessonsRes.data ?? []) as Lesson[];
  const assignments = (assignmentsRes.data ?? []) as CoverageAssignment[];
  const assignmentByLesson = new Map(assignments.map((a) => [a.lesson_id, a]));

  let total = 0;
  let covered = 0;
  let pending = 0;
  let uncovered = 0;

  const dayAbsences: DayAbsence[] = absences
    .map((abs) => {
      const teacher = teacherById.get(abs.teacher_id);
      if (!teacher) return null;
      const window =
        abs.start_time && abs.end_time
          ? { from: abs.start_time, to: abs.end_time }
          : null;
      const lessons = allLessons
        .filter(
          (l) =>
            l.teacher_id === abs.teacher_id &&
            l.weekday === weekday &&
            lessonInWindow(l, window),
        )
        .sort((a, b) => a.period - b.period)
        .map((lesson): DayLesson => {
          const assignment = assignmentByLesson.get(lesson.id) ?? null;
          const status: CoverageStatus = assignment?.status ?? "pending";
          let coveringName: string | null = null;
          if (assignment?.covering_teacher_id)
            coveringName = teacherById.get(assignment.covering_teacher_id)?.name ?? null;
          else if (assignment?.covering_vikar_id)
            coveringName = vikarById.get(assignment.covering_vikar_id) ?? null;

          total += 1;
          if (status === "covered_by_teacher" || status === "covered_by_vikar" || status === "covered_by_coteacher")
            covered += 1;
          else if (status === "uncovered") uncovered += 1;
          else pending += 1;

          return { assignment, lesson, coveringName, status };
        });
      return { teacher, reason: abs.reason, window, lessons };
    })
    .filter((x): x is DayAbsence => x !== null);

  return {
    date,
    weekday,
    absences: dayAbsences,
    summary: { total, covered, pending, uncovered },
  };
}
