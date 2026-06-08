"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Lesson, Teacher } from "@/lib/database.types";
import {
  PERIODS,
  PERIOD_TIMES,
  WEEKDAYS,
  WEEKDAY_NAMES,
} from "@/lib/constants";
import { Button, Card, Field, Input } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { upsertLesson, deleteLesson } from "@/lib/actions/lessons";

function key(weekday: number, period: number) {
  return `${weekday}-${period}`;
}

interface CellTarget {
  weekday: number;
  period: number;
  lesson: Lesson | null;
}

export function ScheduleEditor({
  teacher,
  lessons,
}: {
  teacher: Teacher;
  lessons: Lesson[];
}) {
  const bySlot = new Map<string, Lesson>();
  for (const l of lessons) bySlot.set(key(l.weekday, l.period), l);

  const [target, setTarget] = useState<CellTarget | null>(null);

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-24 border-b border-r border-line bg-canvas px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Time
                </th>
                {WEEKDAYS.map((wd) => (
                  <th
                    key={wd}
                    className="border-b border-line bg-canvas px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted"
                  >
                    {WEEKDAY_NAMES[wd]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((period) => (
                <tr key={period}>
                  <td className="border-b border-r border-line bg-canvas/60 px-3 py-2 align-top">
                    <div className="font-medium text-ink">{period}.</div>
                    <div className="tabular text-[11px] text-muted">
                      {PERIOD_TIMES[period]?.start}
                    </div>
                  </td>
                  {WEEKDAYS.map((wd) => {
                    const lesson = bySlot.get(key(wd, period)) ?? null;
                    return (
                      <td
                        key={wd}
                        className="border-b border-line p-0 align-top"
                      >
                        <button
                          onClick={() =>
                            setTarget({ weekday: wd, period, lesson })
                          }
                          className={`flex h-full min-h-[58px] w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition ${
                            lesson
                              ? "bg-brand-50/40 hover:bg-brand-50"
                              : "text-transparent hover:bg-canvas hover:text-muted"
                          }`}
                        >
                          {lesson ? (
                            <>
                              <span className="font-medium text-ink">
                                {lesson.subject ?? "Time"}
                              </span>
                              <span className="text-xs text-muted">
                                {[lesson.class_group, lesson.room]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs">+ Legg til</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
  target: CellTarget;
  onClose: () => void;
}) {
  const router = useRouter();
  const { lesson, weekday, period } = target;
  const defaults = PERIOD_TIMES[period];

  const [subject, setSubject] = useState(lesson?.subject ?? "");
  const [classGroup, setClassGroup] = useState(lesson?.class_group ?? "");
  const [room, setRoom] = useState(lesson?.room ?? "");
  const [startTime, setStartTime] = useState(lesson?.start_time ?? defaults?.start ?? "");
  const [endTime, setEndTime] = useState(lesson?.end_time ?? defaults?.end ?? "");
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
        period,
        subject,
        class_group: classGroup,
        room,
        start_time: startTime,
        end_time: endTime,
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
    <Modal
      open
      onClose={onClose}
      title={`${WEEKDAY_NAMES[weekday]} · ${period}. time`}
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fag">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Matematikk"
              autoFocus
            />
          </Field>
          <Field label="Klasse">
            <Input
              value={classGroup}
              onChange={(e) => setClassGroup(e.target.value)}
              placeholder="8A"
            />
          </Field>
          <Field label="Rom">
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="R12" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="08:30" />
            </Field>
            <Field label="Slutt">
              <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="09:15" />
            </Field>
          </div>
        </div>

        <p className="text-xs text-muted">
          Tips: bruk samme klasse som en annen lærer på samme dag og time for å
          markere at de har klassen sammen (co-teaching).
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex items-center justify-between pt-2">
          <div>
            {lesson && (
              <Button type="button" variant="danger" onClick={remove} disabled={pending}>
                Slett time
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
