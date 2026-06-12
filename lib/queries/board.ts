// Server-side assembly of the "Oversikt" live board: every active teacher with
// today's lessons (their own + any they're covering), who is sick, and which
// vikars are at school today. The page renders this; the client computes the
// live "now" line and in-class/free status from the times.

import { createClient } from "@/lib/supabase/server";
import { weekdayFromISODate } from "@/lib/coverage";
import {
  lessonClock,
  SCHOOL_DAY_START,
  SCHOOL_DAY_END,
  type CoverageStatus,
} from "@/lib/constants";
import type {
  Absence,
  CoverageAssignment,
  Lesson,
  Teacher,
} from "@/lib/database.types";

export interface BoardLesson {
  id: string;
  start: string; // "HH:MM"
  end: string;
  subject: string | null;
  classGroup: string | null;
  room: string | null;
  kind: "own" | "covering";
  /** Own lesson the teacher is absent for (covered by someone else). */
  coveredAway: boolean;
  /** Who covers this (for coveredAway own lessons). */
  coveringName: string | null;
  /** Whose class this is (for kind === "covering"). */
  coverForName: string | null;
  status: CoverageStatus | null;
}

export interface BoardTeacher {
  id: string;
  name: string;
  absent: boolean;
  absenceWindow: { from: string; to: string } | null;
  lessons: BoardLesson[];
}

export interface BoardVikar {
  id: string;
  name: string;
  phone: string | null;
  classes: {
    subject: string | null;
    classGroup: string | null;
    start: string;
    end: string;
    forName: string;
  }[];
}

export interface TodayBoard {
  date: string;
  weekday: number | null;
  dayStart: string;
  dayEnd: string;
  teachers: BoardTeacher[];
  sick: { id: string; name: string; window: { from: string; to: string } | null }[];
  vikars: BoardVikar[];
  summary: { total: number; covered: number; pending: number; uncovered: number };
}

const COVERED: CoverageStatus[] = [
  "covered_by_teacher",
  "covered_by_vikar",
  "covered_by_coteacher",
];

export async function getTodayBoard(date: string): Promise<TodayBoard> {
  const supabase = await createClient();
  const weekday = weekdayFromISODate(date);

  const [teachersRes, lessonsRes, absencesRes, assignmentsRes, vikarsRes] =
    await Promise.all([
      supabase.from("teachers").select("*").eq("is_active", true).order("name"),
      supabase.from("lessons").select("*"),
      supabase.from("absences").select("*").eq("date", date),
      supabase.from("coverage_assignments").select("*").eq("date", date),
      supabase.from("vikars").select("id, name, phone"),
    ]);

  const teachers = (teachersRes.data ?? []) as Teacher[];
  const allLessons = (lessonsRes.data ?? []) as Lesson[];
  const absences = (absencesRes.data ?? []) as Absence[];
  const assignments = (assignmentsRes.data ?? []) as CoverageAssignment[];

  const teacherName = new Map(teachers.map((t) => [t.id, t.name]));
  // teachers query is active-only, but a covered-for/absent teacher might be
  // inactive; fall back gracefully.
  const vikarName = new Map(
    (vikarsRes.data ?? []).map((v) => [v.id, v.name as string]),
  );
  const vikarPhone = new Map(
    (vikarsRes.data ?? []).map((v) => [v.id, (v.phone as string | null) ?? null]),
  );
  const lessonById = new Map(allLessons.map((l) => [l.id, l]));
  const assignmentByLesson = new Map(assignments.map((a) => [a.lesson_id, a]));
  const absenceByTeacher = new Map(absences.map((a) => [a.teacher_id, a]));

  function coverName(a: CoverageAssignment): string | null {
    if (a.covering_teacher_id) return teacherName.get(a.covering_teacher_id) ?? "Lærer";
    if (a.covering_vikar_id) return vikarName.get(a.covering_vikar_id) ?? "Vikar";
    return null;
  }

  // Track the timeline axis bounds.
  let minStart = SCHOOL_DAY_START;
  let maxEnd = SCHOOL_DAY_END;
  const track = (l: Lesson) => {
    const { start, end } = lessonClock(l);
    if (start < minStart) minStart = start;
    if (end > maxEnd) maxEnd = end;
  };

  const boardTeachers: BoardTeacher[] = teachers.map((t) => {
    const absence = absenceByTeacher.get(t.id) ?? null;
    const absenceWindow =
      absence?.start_time && absence?.end_time
        ? { from: absence.start_time, to: absence.end_time }
        : null;

    // Own lessons today.
    const own: BoardLesson[] = allLessons
      .filter((l) => l.teacher_id === t.id && l.weekday === weekday)
      .map((l) => {
        track(l);
        const { start, end } = lessonClock(l);
        const a = assignmentByLesson.get(l.id);
        return {
          id: l.id,
          start,
          end,
          subject: l.subject,
          classGroup: l.class_group,
          room: l.room,
          kind: "own" as const,
          coveredAway: Boolean(a),
          coveringName: a ? coverName(a) : null,
          coverForName: null,
          status: a?.status ?? null,
        };
      });

    // Lessons this teacher is covering for someone else today.
    const covering: BoardLesson[] = assignments
      .filter((a) => a.covering_teacher_id === t.id)
      .map((a): BoardLesson | null => {
        const l = lessonById.get(a.lesson_id);
        if (!l) return null;
        track(l);
        const { start, end } = lessonClock(l);
        return {
          id: `cover-${a.id}`,
          start,
          end,
          subject: l.subject,
          classGroup: l.class_group,
          room: l.room,
          kind: "covering" as const,
          coveredAway: false,
          coveringName: null,
          coverForName: teacherName.get(a.absent_teacher_id) ?? "lærer",
          status: a.status,
        };
      })
      .filter((x): x is BoardLesson => x !== null);

    return {
      id: t.id,
      name: t.name,
      absent: Boolean(absence),
      absenceWindow,
      lessons: [...own, ...covering].sort((a, b) => a.start.localeCompare(b.start)),
    };
  });

  // Sort: present teachers first (alphabetical), absent ones last.
  boardTeachers.sort(
    (a, b) =>
      Number(a.absent) - Number(b.absent) || a.name.localeCompare(b.name, "nb"),
  );

  // Sick today (with optional window).
  const sick = absences
    .map((a) => ({
      id: a.teacher_id,
      name: teacherName.get(a.teacher_id) ?? "Ukjent",
      window:
        a.start_time && a.end_time ? { from: a.start_time, to: a.end_time } : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));

  // Vikars at school today = those assigned to cover at least one lesson today.
  const vikarMap = new Map<string, BoardVikar>();
  for (const a of assignments) {
    if (!a.covering_vikar_id) continue;
    const l = lessonById.get(a.lesson_id);
    if (!l) continue;
    let v = vikarMap.get(a.covering_vikar_id);
    if (!v) {
      v = {
        id: a.covering_vikar_id,
        name: vikarName.get(a.covering_vikar_id) ?? "Vikar",
        phone: vikarPhone.get(a.covering_vikar_id) ?? null,
        classes: [],
      };
      vikarMap.set(a.covering_vikar_id, v);
    }
    const { start, end } = lessonClock(l);
    v.classes.push({
      subject: l.subject,
      classGroup: l.class_group,
      start,
      end,
      forName: teacherName.get(a.absent_teacher_id) ?? "lærer",
    });
  }
  const vikars = [...vikarMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "nb"),
  );

  // Coverage summary (per lesson needing covering today).
  let covered = 0;
  let pending = 0;
  let uncovered = 0;
  for (const a of assignments) {
    if (COVERED.includes(a.status)) covered += 1;
    else if (a.status === "uncovered") uncovered += 1;
    else pending += 1;
  }

  return {
    date,
    weekday,
    dayStart: minStart,
    dayEnd: maxEnd,
    teachers: boardTeachers,
    sick,
    vikars,
    summary: { total: assignments.length, covered, pending, uncovered },
  };
}
