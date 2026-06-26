import { describe, it, expect } from "vitest";
import {
  weekdayFromISODate,
  coTeachersForLesson,
  availableTeachersForPeriod,
  buildCoveringPeriods,
  countMonthlyCovers,
  absentTeacherIdsForDate,
  computeCoveragePlan,
  type AvailabilityContext,
} from "./coverage";
import type {
  Teacher,
  Lesson,
  Absence,
  CoverageAssignment,
} from "./database.types";
import { lessonInWindow } from "./constants";

/* ---- tiny builders ------------------------------------------------------- */

function teacher(id: string, name: string, is_active = true, role = "laerer"): Teacher {
  return { id, name, phone: null, email: null, is_active, role, created_at: "" };
}
let lid = 0;
function lesson(p: Partial<Lesson> & { teacher_id: string; weekday: number; period: number }): Lesson {
  return {
    id: p.id ?? `l${++lid}`,
    teacher_id: p.teacher_id,
    weekday: p.weekday,
    period: p.period,
    start_time: null,
    end_time: null,
    subject: p.subject ?? "Fag",
    class_group: p.class_group ?? "8A",
    room: p.room ?? null,
    created_at: "",
  };
}
function absence(teacher_id: string, date: string): Absence {
  return {
    id: `a-${teacher_id}-${date}`,
    teacher_id,
    date,
    reason: null,
    absence_type: "egenmelding",
    start_time: null,
    end_time: null,
    created_at: "",
  };
}
function assignment(p: Partial<CoverageAssignment> & { lesson_id: string; date: string }): CoverageAssignment {
  return {
    id: p.id ?? `cov${Math.random()}`,
    date: p.date,
    lesson_id: p.lesson_id,
    absent_teacher_id: p.absent_teacher_id ?? "x",
    covering_teacher_id: p.covering_teacher_id ?? null,
    covering_vikar_id: p.covering_vikar_id ?? null,
    status: p.status ?? "covered_by_teacher",
    is_settled: false,
    settled_at: null,
    notes: null,
    created_at: "",
  };
}

/* ---- date helper --------------------------------------------------------- */

describe("weekdayFromISODate", () => {
  it("maps Mon–Fri to 1–5 and weekends to null", () => {
    expect(weekdayFromISODate("2026-06-08")).toBe(1); // Monday
    expect(weekdayFromISODate("2026-06-12")).toBe(5); // Friday
    expect(weekdayFromISODate("2026-06-13")).toBe(null); // Saturday
    expect(weekdayFromISODate("2026-06-14")).toBe(null); // Sunday
  });
});

/* ---- availability core rules -------------------------------------------- */

describe("availableTeachersForPeriod", () => {
  const anna = teacher("anna", "Anna");
  const bjorn = teacher("bjorn", "Bjørn");
  const cecilie = teacher("cecilie", "Cecilie");
  const dag = teacher("dag", "Dag", /* inactive */ false);

  function ctx(over: Partial<AvailabilityContext> = {}): AvailabilityContext {
    return {
      weekday: 1,
      teachers: [anna, bjorn, cecilie, dag],
      teacherOwnPeriods: new Map(),
      teacherCoveringPeriods: new Map(),
      absentTeacherIds: new Set(),
      monthlyCoverCounts: new Map(),
      ...over,
    };
  }

  it("excludes inactive teachers", () => {
    const out = availableTeachersForPeriod(3, ctx());
    expect(out.map((r) => r.teacher.id)).not.toContain("dag");
  });

  it("excludes teachers absent that day (including the sick teacher)", () => {
    const out = availableTeachersForPeriod(
      3,
      ctx({ absentTeacherIds: new Set(["anna", "bjorn"]) }),
    );
    expect(out.map((r) => r.teacher.id)).toEqual(["cecilie"]);
  });

  it("excludes teachers who already teach that period", () => {
    const own = new Map([["anna", new Set([3])]]);
    const out = availableTeachersForPeriod(3, ctx({ teacherOwnPeriods: own }));
    expect(out.map((r) => r.teacher.id)).not.toContain("anna");
    // ...but Anna IS free at a different period
    expect(
      availableTeachersForPeriod(4, ctx({ teacherOwnPeriods: own })).map((r) => r.teacher.id),
    ).toContain("anna");
  });

  it("prevents double-booking a covering teacher in the same period", () => {
    const covering = new Map([["bjorn", new Set([3])]]);
    const out = availableTeachersForPeriod(3, ctx({ teacherCoveringPeriods: covering }));
    expect(out.map((r) => r.teacher.id)).not.toContain("bjorn");
  });

  it("ranks ascending by month cover-count, tie-break by name", () => {
    const counts = new Map([
      ["anna", 3],
      ["bjorn", 1],
      ["cecilie", 1],
    ]);
    const out = availableTeachersForPeriod(3, ctx({ monthlyCoverCounts: counts }));
    // bjorn & cecilie both 1 -> alphabetical (Bjørn before Cecilie); anna last (3)
    expect(out.map((r) => r.teacher.id)).toEqual(["bjorn", "cecilie", "anna"]);
    expect(out[0].monthCoverCount).toBe(1);
  });
});

/* ---- co-teaching detection ---------------------------------------------- */

describe("coTeachersForLesson", () => {
  it("finds other teachers sharing weekday+period+class_group", () => {
    const main = lesson({ id: "m", teacher_id: "anna", weekday: 1, period: 2, class_group: "8A" });
    const co = lesson({ teacher_id: "bjorn", weekday: 1, period: 2, class_group: "8A" });
    const otherClass = lesson({ teacher_id: "cecilie", weekday: 1, period: 2, class_group: "9B" });
    const { allIds, presentIds } = coTeachersForLesson(main, [main, co, otherClass], new Set());
    expect(allIds).toEqual(["bjorn"]);
    expect(presentIds).toEqual(["bjorn"]);
  });

  it("treats co-teacher as absent when they are also out that day", () => {
    const main = lesson({ id: "m", teacher_id: "anna", weekday: 1, period: 2, class_group: "8A" });
    const co = lesson({ teacher_id: "bjorn", weekday: 1, period: 2, class_group: "8A" });
    const { allIds, presentIds } = coTeachersForLesson(main, [main, co], new Set(["bjorn"]));
    expect(allIds).toEqual(["bjorn"]);
    expect(presentIds).toEqual([]); // all co-teachers out -> needs a real cover
  });
});

/* ---- supporting builders ------------------------------------------------ */

describe("supporting builders", () => {
  it("countMonthlyCovers counts only same-month assignments with a covering teacher", () => {
    const counts = countMonthlyCovers(
      [
        assignment({ lesson_id: "l1", date: "2026-06-02", covering_teacher_id: "anna" }),
        assignment({ lesson_id: "l2", date: "2026-06-20", covering_teacher_id: "anna" }),
        assignment({ lesson_id: "l3", date: "2026-05-30", covering_teacher_id: "anna" }), // prev month
        assignment({ lesson_id: "l4", date: "2026-06-10", covering_teacher_id: null }), // vikar/uncovered
      ],
      "2026-06-08",
    );
    expect(counts.get("anna")).toBe(2);
  });

  it("buildCoveringPeriods can ignore the assignment being re-edited", () => {
    const lessonPeriod = new Map([["l1", 3]]);
    const assignments = [
      assignment({ id: "edit-me", lesson_id: "l1", date: "2026-06-08", covering_teacher_id: "anna" }),
    ];
    const full = buildCoveringPeriods(assignments, "2026-06-08", lessonPeriod);
    expect(full.get("anna")?.has(3)).toBe(true);
    const ignoring = buildCoveringPeriods(assignments, "2026-06-08", lessonPeriod, {
      ignoreAssignmentId: "edit-me",
    });
    expect(ignoring.get("anna")).toBeUndefined();
  });

  it("absentTeacherIdsForDate handles multiple teachers sick the same day", () => {
    const set = absentTeacherIdsForDate(
      [absence("anna", "2026-06-08"), absence("bjorn", "2026-06-08"), absence("cecilie", "2026-06-09")],
      "2026-06-08",
    );
    expect([...set].sort()).toEqual(["anna", "bjorn"]);
  });
});

/* ---- partial-day absence window ----------------------------------------- */

describe("lessonInWindow", () => {
  const morning: Lesson = lesson({ teacher_id: "x", weekday: 1, period: 1 });
  morning.start_time = "08:30";
  morning.end_time = "11:30";
  const afternoon: Lesson = lesson({ teacher_id: "x", weekday: 1, period: 2 });
  afternoon.start_time = "12:30";
  afternoon.end_time = "15:00";

  it("includes every lesson when the window is null (whole day)", () => {
    expect(lessonInWindow(morning, null)).toBe(true);
    expect(lessonInWindow(afternoon, null)).toBe(true);
  });

  it("includes only lessons overlapping the window", () => {
    const w = { from: "11:00", to: "12:45" };
    expect(lessonInWindow(morning, w)).toBe(true); // 08:30–11:30 overlaps at 11:00–11:30
    expect(lessonInWindow(afternoon, w)).toBe(true); // 12:30–15:00 overlaps at 12:30–12:45
  });

  it("excludes lessons entirely outside the window", () => {
    expect(lessonInWindow(afternoon, { from: "08:00", to: "11:00" })).toBe(false);
    expect(lessonInWindow(morning, { from: "13:00", to: "15:00" })).toBe(false);
  });

  it("falls back to default period clock when a lesson has no explicit times", () => {
    const noTimes = lesson({ teacher_id: "x", weekday: 1, period: 3 }); // period 3 => 08:30–11:30
    expect(lessonInWindow(noTimes, { from: "09:00", to: "10:00" })).toBe(true);
    expect(lessonInWindow(noTimes, { from: "13:00", to: "14:00" })).toBe(false);
  });
});

/* ---- end-to-end plan ---------------------------------------------------- */

describe("computeCoveragePlan", () => {
  const anna = teacher("anna", "Anna");
  const bjorn = teacher("bjorn", "Bjørn");
  const cecilie = teacher("cecilie", "Cecilie");

  it("produces one entry per sick lesson, flags sole-teacher vs co-taught, and ranks covers", () => {
    // Monday timetable
    const annaP1 = lesson({ id: "anna-p1", teacher_id: "anna", weekday: 1, period: 1, class_group: "8A", subject: "Matte" });
    const annaP2 = lesson({ id: "anna-p2", teacher_id: "anna", weekday: 1, period: 2, class_group: "8A", subject: "Norsk" });
    const coP2 = lesson({ id: "co-p2", teacher_id: "bjorn", weekday: 1, period: 2, class_group: "8A", subject: "Norsk" }); // co-teaches P2
    const cecilieP1 = lesson({ id: "cec-p1", teacher_id: "cecilie", weekday: 1, period: 1, class_group: "9B" }); // busy at P1
    const allLessons = [annaP1, annaP2, coP2, cecilieP1];

    const plan = computeCoveragePlan({
      date: "2026-06-08", // Monday
      absentTeacherId: "anna",
      teachers: [anna, bjorn, cecilie],
      allLessons,
      absences: [],
      assignments: [],
    });

    expect(plan.weekday).toBe(1);
    expect(plan.lessons.map((l) => l.lesson.id)).toEqual(["anna-p1", "anna-p2"]);

    const p1 = plan.lessons[0];
    expect(p1.isSoleTeacher).toBe(true);
    expect(p1.presentCoTeacherIds).toEqual([]);
    // At P1: Cecilie teaches 9B so she's busy; Bjørn is free -> only Bjørn available
    expect(p1.availableTeachers.map((r) => r.teacher.id)).toEqual(["bjorn"]);

    const p2 = plan.lessons[1];
    expect(p2.isSoleTeacher).toBe(false);
    expect(p2.presentCoTeacherIds).toEqual(["bjorn"]); // Bjørn co-teaches and is present
    // At P2: Bjørn busy co-teaching, Cecilie free -> Cecilie available
    expect(p2.availableTeachers.map((r) => r.teacher.id)).toEqual(["cecilie"]);
  });

  it("flags needsVikar when no internal teacher is free", () => {
    // Both other teachers are busy at period 1 -> vikar needed.
    const annaP1 = lesson({ id: "anna-p1", teacher_id: "anna", weekday: 1, period: 1 });
    const bjornP1 = lesson({ id: "bjorn-p1", teacher_id: "bjorn", weekday: 1, period: 1, class_group: "9B" });
    const cecilieP1 = lesson({ id: "cec-p1", teacher_id: "cecilie", weekday: 1, period: 1, class_group: "10C" });
    const plan = computeCoveragePlan({
      date: "2026-06-08",
      absentTeacherId: "anna",
      teachers: [anna, bjorn, cecilie],
      allLessons: [annaP1, bjornP1, cecilieP1],
      absences: [],
      assignments: [],
    });
    expect(plan.lessons[0].needsVikar).toBe(true);
    expect(plan.lessons[0].availableTeachers).toEqual([]);
  });

  it("only counts real classes as needing cover; non-teaching is skipped but still makes a teacher busy", () => {
    // Anna (Monday): a class at P1, plus office time ("Kontor") at P2.
    const annaClass = lesson({ id: "anna-c", teacher_id: "anna", weekday: 1, period: 1, subject: "Matematikk" });
    const annaKontor = lesson({ id: "anna-k", teacher_id: "anna", weekday: 1, period: 2, subject: "Kontor" });
    // Bjørn is free at P1; Cecilie is on "Tilsyn" (supervision) at P1 -> busy.
    const cecTilsyn = lesson({ id: "cec-t", teacher_id: "cecilie", weekday: 1, period: 1, subject: "Tilsyn" });

    const plan = computeCoveragePlan({
      date: "2026-06-08", // Monday
      absentTeacherId: "anna",
      teachers: [anna, bjorn, cecilie],
      allLessons: [annaClass, annaKontor, cecTilsyn],
      absences: [],
      assignments: [],
    });

    // Only the class needs covering — the "Kontor" slot is not surfaced.
    expect(plan.lessons.map((l) => l.lesson.id)).toEqual(["anna-c"]);
    // Cecilie is busy with supervision at P1, so only Bjørn can cover.
    expect(plan.lessons[0].availableTeachers.map((r) => r.teacher.id)).toEqual(["bjorn"]);
  });

  it("a teacher on office time (Kontor) is available to cover; a duty (Tilsyn) is not", () => {
    const annaClass = lesson({ id: "anna-c", teacher_id: "anna", weekday: 1, period: 1, subject: "Matematikk" });
    const bjornKontor = lesson({ id: "bj-k", teacher_id: "bjorn", weekday: 1, period: 1, subject: "Kontor" });
    const cecTilsyn = lesson({ id: "cec-t", teacher_id: "cecilie", weekday: 1, period: 1, subject: "Tilsyn" });

    const plan = computeCoveragePlan({
      date: "2026-06-08", // Monday
      absentTeacherId: "anna",
      teachers: [anna, bjorn, cecilie],
      allLessons: [annaClass, bjornKontor, cecTilsyn],
      absences: [],
      assignments: [],
    });

    // Bjørn (Kontor) can be pulled in; Cecilie (Tilsyn) cannot.
    expect(plan.lessons[0].availableTeachers.map((r) => r.teacher.id)).toEqual(["bjorn"]);
  });

  it("lists fagarbeidere separately, and offers them even while assisting a class", () => {
    const lae = teacher("lae", "Lærer Larsen", true, "laerer");
    const laeBusy = teacher("laeb", "Lærer Busy", true, "laerer");
    const fag = teacher("fag", "Frida Fagarbeider", true, "fagarbeider");
    const annaClass = lesson({ id: "anna-c", teacher_id: "anna", weekday: 1, period: 1, subject: "Matematikk" });
    // Both the busy lærer and the fagarbeider are in a class at period 1.
    const laeBusyClass = lesson({ id: "lb-c", teacher_id: "laeb", weekday: 1, period: 1, subject: "Norsk", class_group: "9B" });
    const fagAssist = lesson({ id: "fag-c", teacher_id: "fag", weekday: 1, period: 1, subject: "Naturfag", class_group: "10A" });

    const plan = computeCoveragePlan({
      date: "2026-06-08", // Monday
      absentTeacherId: "anna",
      teachers: [anna, lae, laeBusy, fag],
      allLessons: [annaClass, laeBusyClass, fagAssist],
      absences: [],
      assignments: [],
    });

    // The free lærer is offered; the busy lærer is not.
    expect(plan.lessons[0].availableTeachers.map((r) => r.teacher.id)).toEqual(["lae"]);
    // The fagarbeider is offered despite assisting a class at this period.
    expect(plan.lessons[0].availableFagarbeidere.map((r) => r.teacher.id)).toEqual(["fag"]);
  });

  it("returns no lessons for a weekend date", () => {
    const plan = computeCoveragePlan({
      date: "2026-06-13", // Saturday
      absentTeacherId: "anna",
      teachers: [anna],
      allLessons: [lesson({ teacher_id: "anna", weekday: 1, period: 1 })],
      absences: [],
      assignments: [],
    });
    expect(plan.weekday).toBe(null);
    expect(plan.lessons).toEqual([]);
  });
});
