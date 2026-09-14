"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Lesson, Teacher } from "@/lib/database.types";
import {
  WEEKDAYS,
  WEEKDAY_NAMES,
  ACTIVITY_TYPES,
  DEFAULT_ACTIVITY_TYPE,
  inferActivityType,
} from "@/lib/constants";
import { Button, Card, Field, Input } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { upsertLesson, deleteLesson } from "@/lib/actions/lessons";

const PX_PER_MIN = 0.9; // vertical scale of the day
const FALLBACK_START = "08:00";
const FALLBACK_END = "15:00";

const SELECT_CLS =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

/** Block colours per session type. */
const TYPE_STYLE: Record<string, string> = {
  undervisning: "bg-brand-100/80 text-brand-900 ring-brand-200",
  tilsyn: "bg-amber-100/80 text-amber-900 ring-amber-200",
  mote: "bg-violet-100/80 text-violet-900 ring-violet-200",
  kontor: "bg-canvas text-muted ring-line",
  pause: "bg-canvas text-muted ring-line",
  annet: "bg-canvas text-muted ring-line",
};

function toMin(hm: string | null): number | null {
  if (!hm) return null;
  const m = hm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
/** Effective session type for a stored lesson (explicit, else inferred). */
function typeOf(l: Lesson): string {
  return l.activity_type ?? inferActivityType(l.subject);
}

interface EditTarget {
  lesson: Lesson | null;
  weekday: number;
}

export function TeacherTimeline({
  teacher,
  lessons,
}: {
  teacher: Teacher;
  lessons: Lesson[];
}) {
  const [target, setTarget] = useState<EditTarget | null>(null);

  // Day bounds from the data, rounded out to whole hours (with a sane fallback).
  const starts = lessons.map((l) => toMin(l.start_time)).filter((n): n is number => n != null);
  const ends = lessons.map((l) => toMin(l.end_time)).filter((n): n is number => n != null);
  const rawStart = starts.length ? Math.min(...starts) : toMin(FALLBACK_START)!;
  const rawEnd = ends.length ? Math.max(...ends) : toMin(FALLBACK_END)!;
  const dayStart = Math.floor(rawStart / 60) * 60;
  const dayEnd = Math.max(Math.ceil(rawEnd / 60) * 60, dayStart + 60);
  const height = (dayEnd - dayStart) * PX_PER_MIN;

  const hours: number[] = [];
  for (let m = dayStart; m <= dayEnd; m += 60) hours.push(m);

  const byDay = (wd: number) =>
    lessons
      .filter((l) => l.weekday === wd && toMin(l.start_time) != null)
      .sort((a, b) => (toMin(a.start_time)! - toMin(b.start_time)!));

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setTarget({ lesson: null, weekday: 1 })}>+ Ny økt</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="flex min-w-[760px]">
            {/* Time gutter */}
            <div className="w-14 shrink-0 border-r border-line">
              <div className="h-9 border-b border-line" />
              <div className="relative" style={{ height }}>
                {hours.map((m) => (
                  <div
                    key={m}
                    className="absolute right-2 -translate-y-1/2 tabular text-[11px] text-muted"
                    style={{ top: (m - dayStart) * PX_PER_MIN }}
                  >
                    {fmt(m)}
                  </div>
                ))}
              </div>
            </div>

            {/* Weekday columns */}
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="min-w-0 flex-1 border-r border-line last:border-r-0">
                <div className="flex h-9 items-center border-b border-line px-3 text-xs font-medium uppercase tracking-wide text-muted">
                  {WEEKDAY_NAMES[wd]}
                </div>
                <div
                  className="relative cursor-pointer"
                  style={{ height }}
                  onClick={() => setTarget({ lesson: null, weekday: wd })}
                  title="Klikk for å legge til en økt"
                >
                  {/* hour gridlines */}
                  {hours.map((m) => (
                    <div
                      key={m}
                      className="absolute inset-x-0 border-t border-line/60"
                      style={{ top: (m - dayStart) * PX_PER_MIN }}
                    />
                  ))}
                  {/* lesson blocks */}
                  {byDay(wd).map((l) => {
                    const s = toMin(l.start_time)!;
                    const e = toMin(l.end_time) ?? s + 30;
                    const style = TYPE_STYLE[typeOf(l)] ?? TYPE_STYLE.annet;
                    return (
                      <button
                        key={l.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setTarget({ lesson: l, weekday: wd });
                        }}
                        className={`absolute inset-x-1 overflow-hidden rounded-md px-2 py-1 text-left text-[11px] leading-tight ring-1 ${style}`}
                        style={{
                          top: (s - dayStart) * PX_PER_MIN + 1,
                          height: Math.max((e - s) * PX_PER_MIN - 2, 16),
                        }}
                      >
                        <div className="truncate font-medium">{l.subject || "Økt"}</div>
                        <div className="truncate opacity-80">
                          {[l.class_group, `${l.start_time}–${l.end_time}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {target && (
        <LessonModal
          teacher={teacher}
          target={target}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  );
}

function LessonModal({
  teacher,
  target,
  onClose,
}: {
  teacher: Teacher;
  target: EditTarget;
  onClose: () => void;
}) {
  const router = useRouter();
  const { lesson } = target;
  const isNew = !lesson;

  const [weekday, setWeekday] = useState(target.weekday);
  const [subject, setSubject] = useState(lesson?.subject ?? "");
  const [classGroup, setClassGroup] = useState(lesson?.class_group ?? "");
  const [room, setRoom] = useState(lesson?.room ?? "");
  const [type, setType] = useState(
    lesson ? typeOf(lesson) : DEFAULT_ACTIVITY_TYPE,
  );
  const [startTime, setStartTime] = useState(lesson?.start_time ?? "");
  const [endTime, setEndTime] = useState(lesson?.end_time ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await upsertLesson({
        id: lesson?.id,
        teacher_id: teacher.id,
        weekday,
        subject,
        class_group: classGroup,
        room,
        start_time: startTime,
        end_time: endTime,
        activity_type: type,
      });
      if (!res.ok) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  function remove() {
    if (!lesson) return;
    startTransition(async () => {
      const res = await deleteLesson(lesson.id, teacher.id);
      if (!res.ok) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} title={isNew ? "Ny økt" : "Rediger økt"}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={SELECT_CLS}
            >
              {ACTIVITY_TYPES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ukedag">
            <select
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className={SELECT_CLS}
              disabled={!isNew}
            >
              {WEEKDAYS.map((wd) => (
                <option key={wd} value={wd}>
                  {WEEKDAY_NAMES[wd]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fag / innhold">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Matematikk"
              autoFocus
            />
          </Field>
          <Field label="Klasse / gruppe">
            <Input
              value={classGroup}
              onChange={(e) => setClassGroup(e.target.value)}
              placeholder="5. trinn"
            />
          </Field>
          <Field label="Start">
            <Input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="09:00"
              inputMode="numeric"
            />
          </Field>
          <Field label="Slutt">
            <Input
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="10:30"
              inputMode="numeric"
            />
          </Field>
          <Field label="Rom">
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="R12" />
          </Field>
        </div>

        <p className="text-xs text-muted">
          Tips: samme klasse hos to lærere på samme tid markerer at de har klassen
          sammen (co-teaching).
        </p>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex items-center justify-between pt-2">
          <div>
            {lesson && (
              <Button type="button" variant="danger" onClick={remove} disabled={pending}>
                Slett økt
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Lagrer …" : "Lagre"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
