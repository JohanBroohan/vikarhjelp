// The coverage engine — pure, dependency-free logic. Everything here is a plain
// function over plain arrays so it can be unit-tested without a database.
//
// The server action layer (lib/actions/*) gathers rows from Supabase and feeds
// them in; nothing in this file touches the network.

import type {
  Absence,
  CoverageAssignment,
  Lesson,
  Teacher,
} from "./database.types";

/* -------------------------------------------------------------------------- */
/* Date helpers (timezone-safe — operate on YYYY-MM-DD strings)               */
/* -------------------------------------------------------------------------- */

/**
 * Weekday for an ISO date string, Monday=1 .. Friday=5. Returns null for
 * weekends. Parsed in UTC so it never drifts by a day across timezones.
 */
export function weekdayFromISODate(date: string): number | null {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  if (day === 0 || day === 6) return null;
  return day; // Mon=1..Fri=5
}

/** Calendar-month key (YYYY-MM) of an ISO date string. */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/* -------------------------------------------------------------------------- */
/* Building blocks                                                            */
/* -------------------------------------------------------------------------- */

/** teacherId -> set of periods that teacher teaches on the given weekday. */
export function buildTeacherOwnPeriods(
  lessons: Lesson[],
  weekday: number,
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const l of lessons) {
    if (l.weekday !== weekday) continue;
    let set = map.get(l.teacher_id);
    if (!set) map.set(l.teacher_id, (set = new Set()));
    set.add(l.period);
  }
  return map;
}

/**
 * teacherId -> set of periods that teacher is already assigned to cover on the
 * given date. Needs a lesson_id -> period lookup because an assignment only
 * stores the lesson it covers, not the period directly.
 */
export function buildCoveringPeriods(
  assignments: CoverageAssignment[],
  date: string,
  lessonPeriodById: Map<string, number>,
  options: { ignoreAssignmentId?: string } = {},
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const a of assignments) {
    if (a.date !== date) continue;
    if (options.ignoreAssignmentId && a.id === options.ignoreAssignmentId) continue;
    if (!a.covering_teacher_id) continue;
    const period = lessonPeriodById.get(a.lesson_id);
    if (period == null) continue;
    let set = map.get(a.covering_teacher_id);
    if (!set) map.set(a.covering_teacher_id, (set = new Set()));
    set.add(period);
  }
  return map;
}

/** teacherId -> number of lessons they covered in the same calendar month. */
export function countMonthlyCovers(
  assignments: CoverageAssignment[],
  date: string,
): Map<string, number> {
  const key = monthKey(date);
  const counts = new Map<string, number>();
  for (const a of assignments) {
    if (!a.covering_teacher_id) continue;
    if (monthKey(a.date) !== key) continue;
    counts.set(a.covering_teacher_id, (counts.get(a.covering_teacher_id) ?? 0) + 1);
  }
  return counts;
}

/** Set of teacher ids reported absent on the given date. */
export function absentTeacherIdsForDate(
  absences: Absence[],
  date: string,
): Set<string> {
  const set = new Set<string>();
  for (const a of absences) if (a.date === date) set.add(a.teacher_id);
  return set;
}

/**
 * The *other* teachers scheduled for the same weekday+period+class_group as the
 * given lesson, split into all vs. those still present (not absent that date).
 * This is how co-teaching is detected — no extra table.
 */
export function coTeachersForLesson(
  lesson: Lesson,
  lessons: Lesson[],
  absentTeacherIds: Set<string>,
): { allIds: string[]; presentIds: string[] } {
  const allIds = new Set<string>();
  for (const l of lessons) {
    if (l.id === lesson.id) continue;
    if (l.teacher_id === lesson.teacher_id) continue;
    if (
      l.weekday === lesson.weekday &&
      l.period === lesson.period &&
      sameClassGroup(l.class_group, lesson.class_group)
    ) {
      allIds.add(l.teacher_id);
    }
  }
  const presentIds = [...allIds].filter((id) => !absentTeacherIds.has(id));
  return { allIds: [...allIds], presentIds };
}

/** Class-group comparison: trimmed, case-insensitive, null-safe. */
function sameClassGroup(a: string | null, b: string | null): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Availability + ranking                                                     */
/* -------------------------------------------------------------------------- */

export interface RankedTeacher {
  teacher: Teacher;
  /** How many lessons this teacher has already covered this calendar month. */
  monthCoverCount: number;
}

export interface AvailabilityContext {
  weekday: number;
  teachers: Teacher[];
  teacherOwnPeriods: Map<string, Set<number>>;
  teacherCoveringPeriods: Map<string, Set<number>>;
  absentTeacherIds: Set<string>;
  monthlyCoverCounts: Map<string, number>;
}

/**
 * Teachers available to cover a lesson at `period`, ranked fairly: ascending by
 * how many covers they've already done this month, then alphabetically by name.
 *
 * A teacher is available when ALL hold:
 *  - active
 *  - not absent that date (this also excludes the sick teacher, who is absent)
 *  - has no lesson of their own at this weekday+period
 *  - not already assigned to cover another lesson at this same period that date
 */
export function availableTeachersForPeriod(
  period: number,
  ctx: AvailabilityContext,
): RankedTeacher[] {
  const result: RankedTeacher[] = [];
  for (const teacher of ctx.teachers) {
    if (!teacher.is_active) continue;
    if (ctx.absentTeacherIds.has(teacher.id)) continue;
    if (ctx.teacherOwnPeriods.get(teacher.id)?.has(period)) continue;
    if (ctx.teacherCoveringPeriods.get(teacher.id)?.has(period)) continue;
    result.push({
      teacher,
      monthCoverCount: ctx.monthlyCoverCounts.get(teacher.id) ?? 0,
    });
  }
  result.sort(
    (a, b) =>
      a.monthCoverCount - b.monthCoverCount ||
      a.teacher.name.localeCompare(b.teacher.name, "nb"),
  );
  return result;
}

/* -------------------------------------------------------------------------- */
/* High-level plan for the report-absence flow                               */
/* -------------------------------------------------------------------------- */

export interface LessonCoverage {
  lesson: Lesson;
  /** Present co-teachers (same session, not absent). Empty => no prompt. */
  presentCoTeacherIds: string[];
  /** True when the sick teacher was the only teacher for this session. */
  isSoleTeacher: boolean;
  /** Ranked teachers free to cover this lesson's period. */
  availableTeachers: RankedTeacher[];
  /** No internal teacher free => external vikar needed. */
  needsVikar: boolean;
}

export interface CoveragePlanInput {
  date: string;
  absentTeacherId: string;
  teachers: Teacher[];
  /** Every lesson in the school (used for co-teacher + busy-period lookups). */
  allLessons: Lesson[];
  /** Every absence row (filtered to `date` internally). */
  absences: Absence[];
  /** Existing coverage assignments (used for double-booking + month counts). */
  assignments: CoverageAssignment[];
}

/**
 * Build the full per-lesson coverage plan for one teacher's absence on one date.
 * Pure: the caller supplies all rows. Returns one entry per lesson the absent
 * teacher has on that weekday, each with its co-teacher situation, the ranked
 * list of available covers, and whether a vikar is needed.
 */
export function computeCoveragePlan(input: CoveragePlanInput): {
  weekday: number | null;
  lessons: LessonCoverage[];
} {
  const weekday = weekdayFromISODate(input.date);
  if (weekday == null) return { weekday: null, lessons: [] };

  const absentTeacherIds = absentTeacherIdsForDate(input.absences, input.date);
  // Ensure the teacher being reported is treated as absent even before the row
  // is persisted (the report flow computes before saving the absence).
  absentTeacherIds.add(input.absentTeacherId);

  const lessonPeriodById = new Map<string, number>(
    input.allLessons.map((l) => [l.id, l.period]),
  );

  const ctx: AvailabilityContext = {
    weekday,
    teachers: input.teachers,
    teacherOwnPeriods: buildTeacherOwnPeriods(input.allLessons, weekday),
    teacherCoveringPeriods: buildCoveringPeriods(
      input.assignments,
      input.date,
      lessonPeriodById,
    ),
    absentTeacherIds,
    monthlyCoverCounts: countMonthlyCovers(input.assignments, input.date),
  };

  const sickLessons = input.allLessons
    .filter((l) => l.teacher_id === input.absentTeacherId && l.weekday === weekday)
    .sort((a, b) => a.period - b.period);

  const lessons: LessonCoverage[] = sickLessons.map((lesson) => {
    const { allIds, presentIds } = coTeachersForLesson(
      lesson,
      input.allLessons,
      absentTeacherIds,
    );
    const availableTeachers = availableTeachersForPeriod(lesson.period, ctx);
    return {
      lesson,
      presentCoTeacherIds: presentIds,
      isSoleTeacher: allIds.length === 0,
      availableTeachers,
      needsVikar: availableTeachers.length === 0,
    };
  });

  return { weekday, lessons };
}
