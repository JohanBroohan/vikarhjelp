"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Teacher, Vikar } from "@/lib/database.types";
import type { LessonCoverage } from "@/lib/coverage";
import {
  PERIOD_TIMES,
  WEEKDAY_NAMES,
  SCHOOL_DAY_START,
  SCHOOL_DAY_END,
  lessonInWindow,
  ABSENCE_TYPES,
  DEFAULT_ABSENCE_TYPE,
} from "@/lib/constants";
import { pluralTeachers, formatDateLong, capitalize, addDaysISO } from "@/lib/format";
import { weekdayFromISODate } from "@/lib/coverage";
import { Button, Card, Field, Select } from "@/components/ui";
import { DateField } from "@/components/DateField";
import { PhoneLink } from "@/components/PhoneLink";
import {
  loadReportData,
  saveCoverage,
  deleteAbsence,
  registerMultiDayAbsence,
  type LessonDecision,
  type ReportData,
} from "@/lib/actions/coverage";

// 24-hour time options (every 15 min, 06:00–18:00). Used instead of the native
// <input type="time">, whose 12h/24h display follows the browser locale.
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let m = 6 * 60; m <= 18 * 60; m += 15) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
})();

function TimeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options =
    value && !TIME_OPTIONS.includes(value) ? [value, ...TIME_OPTIONS] : TIME_OPTIONS;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="tabular w-24 rounded-lg border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function countSchoolDays(from: string, to: string): number {
  if (to < from) return 0;
  let n = 0;
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    if (weekdayFromISODate(d) != null) n += 1;
  }
  return n;
}

type CoverChoice = { kind: "teacher" | "vikar"; id: string };

export function ReportFlow({
  teachers,
  vikars,
  initialDate,
  initialTeacherId,
}: {
  teachers: Teacher[];
  vikars: Vikar[];
  initialDate: string;
  initialTeacherId: string;
}) {
  const router = useRouter();
  const [teacherId, setTeacherId] = useState(initialTeacherId);
  const [fromDate, setFromDate] = useState(initialDate);
  const [toDate, setToDate] = useState(initialDate);
  const [fromTime, setFromTime] = useState("08:00"); // "" = whole-day start
  const [toTime, setToTime] = useState("16:00"); // "" = whole-day end
  const [data, setData] = useState<ReportData | null>(null);
  const [decisions, setDecisions] = useState<Record<string, LessonDecision>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  // Absence type — defaults to Egenmelding (the ~95% case).
  const [absenceType, setAbsenceType] = useState(DEFAULT_ABSENCE_TYPE);

  // "Hele dagen" (single whole day) vs "Bestemt tidsrom" (from/to date + time).
  const [rangeMode, setRangeMode] = useState(false);

  // Multi-day coverage: one person covers everything (default) vs assign later.
  const [coverMode, setCoverMode] = useState<"single" | "perDay">("single");
  const [coverChoice, setCoverChoice] = useState<CoverChoice | null>(null);

  const invalidRange = toDate < fromDate;
  const isMultiDay = toDate > fromDate;

  // For a single day, the time window (null = whole day).
  const window =
    fromTime || toTime
      ? { from: fromTime || SCHOOL_DAY_START, to: toTime || SCHOOL_DAY_END }
      : null;

  // (Re)load the single-day plan. Skipped for multi-day (covers are assigned
  // per day later from Oversikt).
  useEffect(() => {
    startLoad(async () => {
      if (!teacherId || !fromDate || isMultiDay) {
        setData(null);
        return;
      }
      const res = await loadReportData(fromDate, teacherId);
      if (!res.ok) {
        setError(res.error);
        setData(null);
        return;
      }
      setError(null);
      setData(res.data!);
      setDecisions(buildInitialDecisions(res.data!));
      // Prefill type + times only when editing an existing absence, so we don't
      // clobber what the user is typing for a new one.
      if (Object.keys(res.data!.existing).length > 0) {
        setAbsenceType(res.data!.absenceType ?? DEFAULT_ABSENCE_TYPE);
        const w = res.data!.absenceWindow;
        setFromTime(w?.from ?? "");
        setToTime(w?.to ?? "");
        setRangeMode(Boolean(w)); // a saved time window => "Bestemt tidsrom"
      }
    });
  }, [teacherId, fromDate, isMultiDay]);

  const visibleLessons = (data?.lessons ?? []).filter((lc) =>
    lessonInWindow(lc.lesson, window),
  );

  function setMode(range: boolean) {
    setRangeMode(range);
    if (range) {
      // "Bestemt tidsrom": default to a normal working day if not set.
      if (!fromTime) setFromTime("08:00");
      if (!toTime) setToTime("16:00");
    } else {
      // "Hele dagen": collapse to a single whole day.
      setToDate(fromDate);
      setFromTime("");
      setToTime("");
    }
  }

  function pickWholeDayDate(d: string) {
    setFromDate(d);
    setToDate(d);
  }

  function pickFromDate(d: string) {
    setFromDate(d);
    if (toDate < d) setToDate(d); // keep the range valid
  }

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
        date: fromDate,
        absentTeacherId: teacherId,
        absenceType,
        window,
        decisions: visibleLessons.map((l) => decisions[l.lesson.id]).filter(Boolean),
      });
      if (!res.ok) return setError(res.error);
      router.push("/");
      router.refresh();
    });
  }

  function registerRange() {
    if (!teacherId) return;
    setError(null);
    const cover =
      coverMode === "single" && coverChoice
        ? coverChoice.kind === "teacher"
          ? { teacherId: coverChoice.id }
          : { vikarId: coverChoice.id }
        : null;
    startSave(async () => {
      const res = await registerMultiDayAbsence({
        teacherId,
        absenceType,
        fromDate,
        fromTime: fromTime || null,
        toDate,
        toTime: toTime || null,
        cover,
      });
      if (!res.ok) return setError(res.error);
      router.push("/");
      router.refresh();
    });
  }

  function removeAbsence() {
    if (!confirm("Fjerne dette fraværet og alle dekninger for dagen?")) return;
    startSave(async () => {
      const res = await deleteAbsence(teacherId, fromDate);
      if (!res.ok) return setError(res.error);
      router.push("/");
    });
  }

  const selectedTeacher = teachers.find((t) => t.id === teacherId) ?? null;
  const hasExisting = data && Object.keys(data.existing).length > 0;
  const counts = summarize(visibleLessons, decisions);
  const schoolDays = countSchoolDays(fromDate, toDate);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-xl">
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
          <Field label="Fraværstype">
            <Select value={absenceType} onChange={(e) => setAbsenceType(e.target.value)}>
              {ABSENCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Whole day vs. a specific date/time range */}
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-sm font-medium text-ink">Fraværet gjelder</p>

          <div className="inline-flex rounded-lg bg-canvas p-0.5 ring-1 ring-line">
            <button
              type="button"
              onClick={() => setMode(false)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                !rangeMode ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              Hele dagen
            </button>
            <button
              type="button"
              onClick={() => setMode(true)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                rangeMode ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              Bestemt tidsrom
            </button>
          </div>

          {!rangeMode ? (
            <div className="mt-3 sm:max-w-xs">
              <span className="mb-1.5 block text-sm text-muted">Dato</span>
              <DateField value={fromDate} onChange={pickWholeDayDate} />
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-2xl">
                <div className="space-y-1.5">
                  <span className="block text-sm text-muted">Fra</span>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <DateField value={fromDate} onChange={pickFromDate} />
                    </div>
                    <TimeSelect value={fromTime} onChange={setFromTime} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="block text-sm text-muted">Til</span>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <DateField value={toDate} onChange={setToDate} />
                    </div>
                    <TimeSelect value={toTime} onChange={setToTime} />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                La klokkeslett stå tomt for hele dagen. Velg en senere til-dato for
                fravær over flere dager.
              </p>
            </>
          )}
        </div>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-600/20">
          {error}
        </p>
      )}

      {invalidRange && (
        <Card className="p-6 text-sm text-red-700">
          Til-dato må være lik eller etter fra-dato.
        </Card>
      )}

      {/* Multi-day: pick one cover for the whole period (default), or assign later */}
      {!invalidRange && isMultiDay && selectedTeacher && (
        <>
          <Card className="p-5">
            <p className="font-medium text-ink">Fravær for {selectedTeacher.name}</p>
            <p className="mt-1 text-sm text-muted">
              Fra {capitalize(formatDateLong(fromDate))}
              {fromTime ? ` kl. ${fromTime}` : ""} til {capitalize(formatDateLong(toDate))}
              {toTime ? ` kl. ${toTime}` : ""}.
            </p>
            <p className="mt-1 text-sm text-muted">
              {schoolDays} skoledager i perioden (helger hoppes over).
            </p>
          </Card>

          <Card className="p-5">
            <p className="mb-2 text-sm font-medium text-ink">Hvem dekker?</p>
            <div className="inline-flex rounded-lg bg-canvas p-0.5 ring-1 ring-line">
              <button
                type="button"
                onClick={() => setCoverMode("single")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  coverMode === "single"
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                Én person dekker alt
              </button>
              <button
                type="button"
                onClick={() => setCoverMode("perDay")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  coverMode === "perDay"
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                Tildel per dag og time
              </button>
            </div>

            {coverMode === "single" ? (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-muted">
                  Velg én lærer eller vikar som dekker alle timene i hele perioden.
                  Alle vises – også de som selv har undervisning i tidsrommet.
                </p>

                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                    Lærere
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {teachers
                      .filter((t) => t.id !== teacherId)
                      .map((t) => (
                        <OptionRow
                          key={t.id}
                          selected={
                            coverChoice?.kind === "teacher" && coverChoice.id === t.id
                          }
                          onClick={() => setCoverChoice({ kind: "teacher", id: t.id })}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink">{t.name}</div>
                            <div className="text-xs text-muted">
                              <PhoneLink phone={t.phone} />
                            </div>
                          </div>
                        </OptionRow>
                      ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                    Vikarer
                  </p>
                  {vikars.length === 0 ? (
                    <p className="text-sm text-muted">Ingen aktive vikarer registrert.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {vikars.map((v) => (
                        <OptionRow
                          key={v.id}
                          selected={
                            coverChoice?.kind === "vikar" && coverChoice.id === v.id
                          }
                          onClick={() => setCoverChoice({ kind: "vikar", id: v.id })}
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
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800 ring-1 ring-brand-600/15">
                Fraværet registreres for alle dagene. Timene blir stående som «udekket»
                — tildel vikar eller lærer per dag og time fra Oversikt («Fravær i
                dag»).
              </p>
            )}
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 mt-2 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => router.push("/")}>
                Avbryt
              </Button>
              <Button
                onClick={registerRange}
                disabled={
                  saving ||
                  schoolDays === 0 ||
                  (coverMode === "single" && !coverChoice)
                }
              >
                {saving ? "Registrerer …" : `Registrer fravær (${schoolDays} dager)`}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Single day: assign covers inline */}
      {!invalidRange && !isMultiDay && (
        <>
          {loading && <p className="text-sm text-muted">Beregner dekning …</p>}

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
          {data && data.weekday != null && data.lessons.length > 0 && visibleLessons.length === 0 && window && (
            <Card className="p-6 text-sm text-muted">
              Ingen timer overlapper med tidsrommet {window.from}–{window.to}. Juster
              tidene eller la dem stå tomme.
            </Card>
          )}

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
        {/* Left: lesson identity — time, subject (fag), class (trinn) */}
        <div className="border-b border-line bg-canvas/50 p-4 lg:border-b-0 lg:border-r">
          <div className="tabular text-lg font-semibold text-ink">
            {lesson.start_time ?? PERIOD_TIMES[lesson.period]?.start}
            {(lesson.end_time ?? PERIOD_TIMES[lesson.period]?.end)
              ? `–${lesson.end_time ?? PERIOD_TIMES[lesson.period]?.end}`
              : ""}
          </div>
          <div className="mt-1 font-medium text-ink">{lesson.subject ?? "Time"}</div>
          {lesson.class_group && (
            <div className="text-sm text-muted">{lesson.class_group}</div>
          )}
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

              {/* Fagarbeidere — fallback after lærere and vikarer */}
              {lc.availableFagarbeidere.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                    Fagarbeidere
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {lc.availableFagarbeidere.map((rt) => (
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
