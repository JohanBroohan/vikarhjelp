// Server-side query helpers for the Historikk (extra-hours) reports. Shared by
// the report pages and the CSV export route so they always agree on what counts.
//
// "Extra hours" = coverage assignments where someone actually covered — a
// teacher/fagarbeider (covering_teacher_id) OR an external vikar
// (covering_vikar_id). Co-teacher covers log no extra hours for anyone.

import { createClient } from "@/lib/supabase/server";
import { lessonClock } from "@/lib/constants";
import type { DateRange } from "@/lib/reports";
import type { Absence, CoverageAssignment, Lesson } from "@/lib/database.types";

export type CovererKind = "teacher" | "vikar";

export interface CoverRow {
  id: string;
  date: string;
  period: number;
  /** Lesson clock times ("HH:MM"), from the lesson or its period default. */
  start: string;
  end: string;
  classGroup: string | null;
  subject: string | null;
  room: string | null;
  coveringId: string;
  coveringName: string;
  coveringKind: CovererKind;
  absentTeacherName: string;
}

export interface AbsenceRow {
  id: string;
  date: string;
  /** Absence type slug (see ABSENCE_TYPES). */
  absenceType: string;
  /** Partial-day window, or null for a whole-day absence. */
  window: { from: string; to: string } | null;
}

export interface TeacherTotal {
  id: string;
  name: string;
  kind: CovererKind;
  total: number;
  /** Days this person was absent within the range (vikars: always 0). */
  absenceDays: number;
}

/** Limit a query to one coverer (a teacher OR a vikar). */
export type CovererFilter = { teacherId: string } | { vikarId: string } | undefined;

async function fetchRawCovers(range: DateRange, coverer: CovererFilter) {
  const supabase = await createClient();

  let query = supabase.from("coverage_assignments").select("*");
  if (coverer && "teacherId" in coverer) {
    query = query.eq("covering_teacher_id", coverer.teacherId);
  } else if (coverer && "vikarId" in coverer) {
    query = query.eq("covering_vikar_id", coverer.vikarId);
  }
  // For the "anyone" case we fetch the range and skip non-covered rows in the
  // mapper below (rows with neither a covering teacher nor vikar).
  if (range.from) query = query.gte("date", range.from);
  if (range.to) query = query.lte("date", range.to);

  const [coversRes, lessonsRes, teachersRes, vikarsRes] = await Promise.all([
    query.order("date", { ascending: false }),
    supabase.from("lessons").select("*"),
    supabase.from("teachers").select("id, name"),
    supabase.from("vikars").select("id, name"),
  ]);

  const covers = (coversRes.data ?? []) as CoverageAssignment[];
  const lessonById = new Map(
    ((lessonsRes.data ?? []) as Lesson[]).map((l) => [l.id, l]),
  );
  const teacherName = new Map(
    (teachersRes.data ?? []).map((t) => [t.id, t.name as string]),
  );
  const vikarName = new Map(
    (vikarsRes.data ?? []).map((v) => [v.id, v.name as string]),
  );
  return { covers, lessonById, teacherName, vikarName };
}

/** Enriched, sorted list of individual covers (for drilldown + CSV). */
export async function fetchCoverRows(
  range: DateRange,
  coverer?: CovererFilter,
): Promise<CoverRow[]> {
  const { covers, lessonById, teacherName, vikarName } = await fetchRawCovers(
    range,
    coverer,
  );

  return covers
    .map((c): CoverRow | null => {
      const lesson = lessonById.get(c.lesson_id);
      if (!lesson) return null;

      let coveringId: string;
      let coveringName: string;
      let coveringKind: CovererKind;
      if (c.covering_teacher_id) {
        coveringId = c.covering_teacher_id;
        coveringName = teacherName.get(c.covering_teacher_id) ?? "Ukjent";
        coveringKind = "teacher";
      } else if (c.covering_vikar_id) {
        coveringId = c.covering_vikar_id;
        coveringName = vikarName.get(c.covering_vikar_id) ?? "Ukjent";
        coveringKind = "vikar";
      } else {
        return null; // not actually covered (pending/uncovered)
      }

      const clock = lessonClock(lesson);
      return {
        id: c.id,
        date: c.date,
        period: lesson.period,
        start: clock.start,
        end: clock.end,
        classGroup: lesson.class_group,
        subject: lesson.subject,
        room: lesson.room,
        coveringId,
        coveringName,
        coveringKind,
        absentTeacherName: teacherName.get(c.absent_teacher_id) ?? "Ukjent",
      };
    })
    .filter((r): r is CoverRow => r !== null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.period - b.period));
}

/** A teacher's own absences within the range (most recent first). */
export async function fetchAbsenceRows(
  range: DateRange,
  teacherId: string,
): Promise<AbsenceRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("absences")
    .select("id, date, absence_type, start_time, end_time")
    .eq("teacher_id", teacherId);
  if (range.from) query = query.gte("date", range.from);
  if (range.to) query = query.lte("date", range.to);
  const { data } = await query.order("date", { ascending: false });

  return (
    (data ?? []) as Pick<
      Absence,
      "id" | "date" | "absence_type" | "start_time" | "end_time"
    >[]
  ).map((a) => ({
    id: a.id,
    date: a.date,
    absenceType: a.absence_type,
    window:
      a.start_time && a.end_time ? { from: a.start_time, to: a.end_time } : null,
  }));
}

export interface AbsenceExportRow extends AbsenceRow {
  /** The absent teacher's name (for CSV export across everyone). */
  name: string;
}

/**
 * Absences for the CSV export — for one teacher (when `teacherId` is given) or
 * everyone, each enriched with the teacher's name.
 */
export async function fetchAbsenceExportRows(
  range: DateRange,
  teacherId?: string,
): Promise<AbsenceExportRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("absences")
    .select("id, teacher_id, date, absence_type, start_time, end_time");
  if (teacherId) query = query.eq("teacher_id", teacherId);
  if (range.from) query = query.gte("date", range.from);
  if (range.to) query = query.lte("date", range.to);

  const [absRes, teachersRes] = await Promise.all([
    query.order("date", { ascending: false }),
    supabase.from("teachers").select("id, name"),
  ]);
  const teacherName = new Map(
    (teachersRes.data ?? []).map((t) => [t.id, t.name as string]),
  );

  return (
    (absRes.data ?? []) as Pick<
      Absence,
      "id" | "teacher_id" | "date" | "absence_type" | "start_time" | "end_time"
    >[]
  ).map((a) => ({
    id: a.id,
    name: teacherName.get(a.teacher_id) ?? "Ukjent",
    date: a.date,
    absenceType: a.absence_type,
    window:
      a.start_time && a.end_time ? { from: a.start_time, to: a.end_time } : null,
  }));
}

/**
 * Per-coverer totals (for the Historikk overview table): extra hours covered
 * (teachers, fagarbeidere AND vikars) plus days absent, for anyone who covered
 * or was absent in the range.
 */
export async function fetchTeacherTotals(range: DateRange): Promise<TeacherTotal[]> {
  const supabase = await createClient();

  let absQuery = supabase.from("absences").select("teacher_id, date");
  if (range.from) absQuery = absQuery.gte("date", range.from);
  if (range.to) absQuery = absQuery.lte("date", range.to);

  const [rows, absRes, teachersRes] = await Promise.all([
    fetchCoverRows(range),
    absQuery,
    supabase.from("teachers").select("id, name"),
  ]);
  const teacherName = new Map(
    (teachersRes.data ?? []).map((t) => [t.id, t.name as string]),
  );

  const byId = new Map<string, TeacherTotal>();
  const ensure = (id: string, name: string, kind: CovererKind) => {
    let t = byId.get(id);
    if (!t) {
      t = { id, name, kind, total: 0, absenceDays: 0 };
      byId.set(id, t);
    }
    return t;
  };

  for (const r of rows) {
    const t = ensure(r.coveringId, r.coveringName, r.coveringKind);
    t.total += 1;
  }
  for (const a of absRes.data ?? []) {
    const t = ensure(a.teacher_id, teacherName.get(a.teacher_id) ?? "Ukjent", "teacher");
    t.absenceDays += 1;
  }

  return [...byId.values()].sort(
    (a, b) =>
      b.total - a.total ||
      b.absenceDays - a.absenceDays ||
      a.name.localeCompare(b.name, "nb"),
  );
}
