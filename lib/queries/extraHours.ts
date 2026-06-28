// Server-side query helpers for the Ekstratimer reports. Shared by the report
// pages and the CSV export route so they always agree on what counts.
//
// "Extra hours" = coverage assignments where a *teacher* did the covering
// (covering_teacher_id is set). Vikar covers are external; co-teacher covers
// log no extra hours for anyone.

import { createClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/reports";
import type { CoverageAssignment, Lesson } from "@/lib/database.types";

export interface CoverRow {
  id: string;
  date: string;
  period: number;
  classGroup: string | null;
  subject: string | null;
  room: string | null;
  coveringTeacherId: string;
  coveringTeacherName: string;
  absentTeacherName: string;
  isSettled: boolean;
}

export interface TeacherTotal {
  teacherId: string;
  teacherName: string;
  total: number;
  settled: number;
  unsettled: number;
  /** Days this person was absent within the range. */
  absenceDays: number;
}

async function fetchRawCovers(
  range: DateRange,
  coveringTeacherId?: string,
): Promise<{ covers: CoverageAssignment[]; lessonById: Map<string, Lesson>; nameById: Map<string, string> }> {
  const supabase = await createClient();

  let query = supabase
    .from("coverage_assignments")
    .select("*")
    .not("covering_teacher_id", "is", null);
  if (range.from) query = query.gte("date", range.from);
  if (range.to) query = query.lte("date", range.to);
  if (coveringTeacherId) query = query.eq("covering_teacher_id", coveringTeacherId);

  const [coversRes, lessonsRes, teachersRes] = await Promise.all([
    query.order("date", { ascending: false }),
    supabase.from("lessons").select("*"),
    supabase.from("teachers").select("id, name"),
  ]);

  const covers = (coversRes.data ?? []) as CoverageAssignment[];
  const lessonById = new Map(
    ((lessonsRes.data ?? []) as Lesson[]).map((l) => [l.id, l]),
  );
  const nameById = new Map(
    (teachersRes.data ?? []).map((t) => [t.id, t.name as string]),
  );
  return { covers, lessonById, nameById };
}

/** Enriched, sorted list of individual covers (for drilldown + CSV). */
export async function fetchCoverRows(
  range: DateRange,
  coveringTeacherId?: string,
): Promise<CoverRow[]> {
  const { covers, lessonById, nameById } = await fetchRawCovers(
    range,
    coveringTeacherId,
  );

  return covers
    .map((c): CoverRow | null => {
      const lesson = lessonById.get(c.lesson_id);
      if (!lesson || !c.covering_teacher_id) return null;
      return {
        id: c.id,
        date: c.date,
        period: lesson.period,
        classGroup: lesson.class_group,
        subject: lesson.subject,
        room: lesson.room,
        coveringTeacherId: c.covering_teacher_id,
        coveringTeacherName: nameById.get(c.covering_teacher_id) ?? "Ukjent",
        absentTeacherName: nameById.get(c.absent_teacher_id) ?? "Ukjent",
        isSettled: c.is_settled,
      };
    })
    .filter((r): r is CoverRow => r !== null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.period - b.period));
}

/**
 * Per-employee totals (for the Historikk overview table): extra hours covered
 * plus days absent, for anyone who covered OR was absent in the range.
 */
export async function fetchTeacherTotals(range: DateRange): Promise<TeacherTotal[]> {
  const supabase = await createClient();

  // Absences in range + a name lookup (for people who only have absences).
  let absQuery = supabase.from("absences").select("teacher_id, date");
  if (range.from) absQuery = absQuery.gte("date", range.from);
  if (range.to) absQuery = absQuery.lte("date", range.to);

  const [rows, absRes, teachersRes] = await Promise.all([
    fetchCoverRows(range),
    absQuery,
    supabase.from("teachers").select("id, name"),
  ]);
  const nameById = new Map(
    (teachersRes.data ?? []).map((t) => [t.id, t.name as string]),
  );

  const byTeacher = new Map<string, TeacherTotal>();
  const ensure = (id: string, name: string) => {
    let t = byTeacher.get(id);
    if (!t) {
      t = {
        teacherId: id,
        teacherName: name,
        total: 0,
        settled: 0,
        unsettled: 0,
        absenceDays: 0,
      };
      byTeacher.set(id, t);
    }
    return t;
  };

  for (const r of rows) {
    const t = ensure(r.coveringTeacherId, r.coveringTeacherName);
    t.total += 1;
    if (r.isSettled) t.settled += 1;
    else t.unsettled += 1;
  }
  for (const a of absRes.data ?? []) {
    const t = ensure(a.teacher_id, nameById.get(a.teacher_id) ?? "Ukjent");
    t.absenceDays += 1;
  }

  return [...byTeacher.values()].sort(
    (a, b) =>
      b.total - a.total ||
      b.absenceDays - a.absenceDays ||
      a.teacherName.localeCompare(b.teacherName, "nb"),
  );
}
