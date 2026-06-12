"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Teacher } from "@/lib/database.types";
import type { LessonCoverage } from "@/lib/coverage";
import {
  PERIOD_TIMES,
  WEEKDAY_NAMES,
  SCHOOL_DAY_START,
  SCHOOL_DAY_END,
  lessonInWindow,
} from "@/lib/constants";
import { pluralTeachers } from "@/lib/format";
import { Button, Card, Field, Select } from "@/components/ui";
import { DateField } from "@/components/DateField";
import { PhoneLink } from "@/components/PhoneLink";
import {
  loadReportData,
  saveCoverage,
  deleteAbsence,
  type LessonDecision,
  type ReportData,
} from "@/lib/actions/coverage";

export function ReportFlow({
  teachers,
  initialDate,
  initialTeacherId,
}: {
  teachers: Teacher[];
  initialDate: string;
  initialTeacherId: string;
}) {
  const router = useRouter();
  const [teacherId, setTeacherId] = useState(initialTeacherId);
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<ReportData | null>(null);
  const [decisions, setDecisions] = useState<Record<string, LessonDecision>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  // Absence time window: whole day, or a specific range like 11:00–12:30.
  const [wholeDay, setWholeDay] = useState(true);
  const [winFrom, setWinFrom] = useState(SCHOOL_DAY_START);
  const [winTo, setWinTo] = useState(SCHOOL_DAY_END);

  // (Re)load the plan whenever teacher or date changes. All state updates run
  // inside the transition callback (never synchronously in the effect body).
  useEffect(() => {
    startLoad(async () => {
      if (!teacherId || !date) {
        setData(null);
        return;
      }
      const res = await loadReportData(date, teacherId);
      if (!res.ok) {
        setError(res.error);
        setData(null);
        return;
      }
      setError(null);
      setData(res.data!);
      setDecisions(buildInitialDecisions(res.data!));
      // Prefill the window from a previously-saved partial-day absence.
      const w = res.data!.absenceWindow;
      setWholeDay(!w);
      setWinFrom(w?.from ?? SCHOOL_DAY_START);
      setWinTo(w?.to ?? SCHOOL_DAY_END);
    });
  }, [teacherId, date]);

  const window = wholeDay ? null : { from: winFrom, to: winTo };
  const visibleLessons = (data?.lessons ?? []).filter((lc) =>
    lessonInWindow(lc.lesson, window),
  );

  function setDecision(lessonId: string, patch: Partial<LessonDecision>) {
    setDecisions((prev) => ({
      ...prev,
      [lessonId]: { ...prev[lessonId], lessonId, ...patch } as LessonDecision,
    }));
  }

  function save() {
    if (!data) return;
    setError(null);
    startSave(async () => {
      const res = await saveCoverage({
        date,
        absentTeacherId: teacherId,
        window,
        decisions: visibleLessons.map((l) => decisions[l.lesson.id]).filter(Boolean),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Send the user to the "I dag" overview to see the result.
      router.push("/");
      router.refresh();
    });
  }

  function removeAbsence() {
    if (!confirm("Fjerne dette fraværet og alle dekninger for dagen?")) return;
    startSave(async () => {
      const res = await deleteAbsence(teacherId, date);
      if (!res.ok) return setError(res.error);
      router.push("/");
    });
  }

  const selectedTeacher = teachers.find((t) => t.id === teacherId) ?? null;
  const hasExisting = data && Object.keys(data.existing).length > 0;

  const counts = summarize(visibleLessons, decisions);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-2xl">
          <Field label="Lærer som er borte">
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Velg lærer …</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dato">
            <DateField value={date} onChange={setDate} />
          </Field>
        </div>

        {/* Whole day vs. a specific time window */}
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-sm font-medium text-ink">Fraværet gjelder</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-lg bg-canvas p-0.5 ring-1 ring-line">
              <button
                type="button"
                onClick={() => setWholeDay(true)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  wholeDay ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                Hele dagen
              </button>
              <button
                type="button"
                onClick={() => setWholeDay(false)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  !wholeDay ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                Bestemt tidsrom
              </button>
            </div>

            {!wholeDay && (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="time"
                  value={winFrom}
                  onChange={(e) => setWinFrom(e.target.value)}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
                <span className="text-muted">til</span>
                <input
                  type="time"
                  value={winTo}
                  onChange={(e) => setWinTo(e.target.value)}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            )}
          </div>
          {!wholeDay && (
            <p className="mt-2 text-xs text-muted">
              Bare timer som overlapper med {winFrom}–{winTo} trenger dekning.
            </p>
          )}
        </div>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-600/20">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-muted">Beregner dekning …</p>}

      {/* Weekend / no lessons */}
      {data && data.weekday == null && (
        <Card className="p-6 text-sm text-muted">
          Valgt dato er i helgen — det er ingen timer å dekke.
        </Card>
      )}
      {data && data.weekday != null && data.lessons.length === 0 && selectedTeacher && (
        <Card className="p-6 text-sm text-muted">
          {selectedTeacher.name} har ingen timer på {WEEKDAY_NAMES[data.weekday].toLowerCase()}.
        </Card>
      )}
      {data && data.weekday != null && data.lessons.length > 0 && visibleLessons.length === 0 && (
        <Card className="p-6 text-sm text-muted">
          Ingen timer overlapper med tidsrommet {winFrom}–{winTo}. Juster tidsrommet
          eller velg «Hele dagen».
        </Card>
      )}

      {/* Lessons */}
      {data && visibleLessons.length > 0 && (
        <>
          {hasExisting && (
            <p className="rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800 ring-1 ring-brand-600/15">
              Dette fraværet er allerede registrert. Du redigerer en eksisterende dag.
            </p>
          )}

          <div className="space-y-4">
            {visibleLessons.map((lc) => (
              <LessonCard
                key={lc.lesson.id}
                lc={lc}
                data={data}
                decision={decisions[lc.lesson.id]}
                onChange={(patch) => setDecision(lc.lesson.id, patch)}
              />
            ))}
          </div>

          {/* Sticky save bar */}
          <div className="sticky bottom-0 z-10 -mx-1 mt-2 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-muted">
                  {counts.total} timer ·{" "}
                  <span className="font-medium text-emerald-700">{counts.covered} dekket</span> ·{" "}
                  <span className="font-medium text-amber-700">{counts.pending} venter</span> ·{" "}
                  <span className="font-medium text-red-700">{counts.uncovered} udekket</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasExisting && (
                  <Button variant="danger" onClick={removeAbsence} disabled={saving}>
                    Slett fravær
                  </Button>
                )}
                <Button variant="secondary" onClick={() => router.push("/")}>
                  Til oversikt
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Lagrer …" : "Lagre dekning"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function LessonCard({
  lc,
  data,
  decision,
  onChange,
}: {
  lc: LessonCoverage;
  data: ReportData;
  decision: LessonDecision | undefined;
  onChange: (patch: Partial<LessonDecision>) => void;
}) {
  const { lesson } = lc;
  const kind = decision?.kind ?? "pending";
  const coTeacherNames = lc.presentCoTeacherIds
    .map((id) => data.teachersById[id]?.name)
    .filter(Boolean) as string[];
  const hasPresentCoTeachers = coTeacherNames.length > 0;

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">
        {/* Left: lesson identity */}
        <div className="border-b border-line bg-canvas/50 p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-ink">{lesson.period}. time</span>
            <span className="tabular text-xs text-muted">
              {lesson.start_time ?? PERIOD_TIMES[lesson.period]?.start}
              {lesson.end_time ? `–${lesson.end_time}` : ""}
            </span>
          </div>
          <div className="mt-1 font-medium text-ink">{lesson.subject ?? "Time"}</div>
          <div className="text-sm text-muted">
            {[lesson.class_group, lesson.room].filter(Boolean).join(" · ") || "—"}
          </div>
          <div className="mt-3">
            <CardStatusPill kind={kind} />
          </div>
        </div>

        {/* Right: decision UI */}
        <div className="p-4">
          {hasPresentCoTeachers && (
            <CoTeacherPrompt
              names={coTeacherNames}
              needsVikar={kind !== "coteacher"}
              onAnswer={(needs) =>
                onChange(
                  needs
                    ? { kind: "pending", coveringTeacherId: null, coveringVikarId: null }
                    : { kind: "coteacher", coveringTeacherId: null, coveringVikarId: null },
                )
              }
            />
          )}

          {/* Coverage options (shown unless covered by co-teacher) */}
          {kind !== "coteacher" && (
            <div className="space-y-3">
              {lc.needsVikar ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-600/20">
                  Ingen lærer er ledig denne timen — ring en vikar.
                </p>
              ) : (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                    Ledige lærere
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {lc.availableTeachers.map((rt) => (
                      <OptionRow
                        key={rt.teacher.id}
                        selected={kind === "teacher" && decision?.coveringTeacherId === rt.teacher.id}
                        onClick={() =>
                          onChange({
                            kind: "teacher",
                            coveringTeacherId: rt.teacher.id,
                            coveringVikarId: null,
                          })
                        }
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{rt.teacher.name}</div>
                          <div className="text-xs text-muted">
                            <PhoneLink phone={rt.teacher.phone} />
                          </div>
                        </div>
                        <span
                          className="ml-auto shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs text-muted ring-1 ring-line"
                          title="Ekstratimer denne måneden"
                        >
                          {rt.monthCoverCount} i mnd.
                        </span>
                      </OptionRow>
                    ))}
                  </div>
                </div>
              )}

              {/* Vikar list */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  Vikarer
                </p>
                {data.vikars.length === 0 ? (
                  <p className="text-sm text-muted">Ingen aktive vikarer registrert.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {data.vikars.map((v) => (
                      <OptionRow
                        key={v.id}
                        selected={kind === "vikar" && decision?.coveringVikarId === v.id}
                        onClick={() =>
                          onChange({
                            kind: "vikar",
                            coveringVikarId: v.id,
                            coveringTeacherId: null,
                          })
                        }
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{v.name}</div>
                          <div className="text-xs text-muted">
                            <PhoneLink phone={v.phone} />
                            {v.notes ? ` · ${v.notes}` : ""}
                          </div>
                        </div>
                      </OptionRow>
                    ))}
                  </div>
                )}
              </div>

              {/* Leave uncovered / reset */}
              <div className="flex flex-wrap gap-2 pt-1">
                <MiniToggle
                  active={kind === "uncovered"}
                  onClick={() =>
                    onChange({ kind: "uncovered", coveringTeacherId: null, coveringVikarId: null })
                  }
                >
                  La stå udekket
                </MiniToggle>
                <MiniToggle
                  active={kind === "pending"}
                  onClick={() =>
                    onChange({ kind: "pending", coveringTeacherId: null, coveringVikarId: null })
                  }
                >
                  Nullstill
                </MiniToggle>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function CoTeacherPrompt({
  names,
  needsVikar,
  onAnswer,
}: {
  names: string[];
  needsVikar: boolean;
  onAnswer: (needsVikar: boolean) => void;
}) {
  return (
    <div className="mb-4 rounded-lg bg-sky-50 p-3 ring-1 ring-sky-600/15">
      <p className="text-sm text-sky-900">
        {pluralTeachers(names.length)} er fortsatt til stede: {names.join(", ")}.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm font-medium text-sky-900">
          Trenger du fortsatt vikar for denne timen?
        </span>
        <button
          onClick={() => onAnswer(false)}
          className={`rounded-lg px-3 py-1 text-sm font-medium transition ${
            !needsVikar ? "bg-sky-600 text-white" : "bg-surface text-sky-900 ring-1 ring-sky-600/30"
          }`}
        >
          Nei
        </button>
        <button
          onClick={() => onAnswer(true)}
          className={`rounded-lg px-3 py-1 text-sm font-medium transition ${
            needsVikar ? "bg-sky-600 text-white" : "bg-surface text-sky-900 ring-1 ring-sky-600/30"
          }`}
        >
          Ja
        </button>
      </div>
    </div>
  );
}

function OptionRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
        selected
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
          : "border-line bg-surface hover:bg-canvas"
      }`}
    >
      {children}
    </button>
  );
}

function MiniToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-ink text-white" : "text-muted ring-1 ring-line hover:bg-canvas"
      }`}
    >
      {children}
    </button>
  );
}

function CardStatusPill({ kind }: { kind: LessonDecision["kind"] }) {
  const map: Record<LessonDecision["kind"], { label: string; cls: string }> = {
    pending: { label: "Venter", cls: "status-pending" },
    teacher: { label: "Lærer valgt", cls: "status-covered" },
    vikar: { label: "Vikar valgt", cls: "status-covered" },
    coteacher: { label: "Medlærer dekker", cls: "status-coteacher" },
    uncovered: { label: "Udekket", cls: "status-uncovered" },
  };
  const m = map[kind];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

function buildInitialDecisions(data: ReportData): Record<string, LessonDecision> {
  const out: Record<string, LessonDecision> = {};
  for (const lc of data.lessons) {
    const existing = data.existing[lc.lesson.id];
    if (existing) {
      out[lc.lesson.id] = existing;
      continue;
    }
    // Lean co-taught lessons (with present co-teachers) toward "no vikar".
    const defaultKind: LessonDecision["kind"] =
      lc.presentCoTeacherIds.length > 0 ? "coteacher" : "pending";
    out[lc.lesson.id] = {
      lessonId: lc.lesson.id,
      kind: defaultKind,
      coveringTeacherId: null,
      coveringVikarId: null,
    };
  }
  return out;
}

function summarize(
  lessons: LessonCoverage[],
  decisions: Record<string, LessonDecision>,
) {
  let covered = 0;
  let pending = 0;
  let uncovered = 0;
  for (const lc of lessons) {
    const k = decisions[lc.lesson.id]?.kind ?? "pending";
    if (k === "teacher" || k === "vikar" || k === "coteacher") covered += 1;
    else if (k === "uncovered") uncovered += 1;
    else pending += 1;
  }
  return { total: lessons.length, covered, pending, uncovered };
}
