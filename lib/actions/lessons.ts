"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { type ActionResult, nullableText } from "./_common";

export interface LessonInput {
  id?: string;
  teacher_id: string;
  weekday: number;
  /** Optional slot number. Auto-assigned for new time-based sessions. */
  period?: number;
  subject?: string | null;
  class_group?: string | null;
  room?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  activity_type?: string | null;
}

/** Next free slot number for a teacher on a weekday (keeps period unique). */
async function nextPeriod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
  weekday: number,
): Promise<number> {
  const { data } = await supabase
    .from("lessons")
    .select("period")
    .eq("teacher_id", teacherId)
    .eq("weekday", weekday)
    .order("period", { ascending: false })
    .limit(1);
  const max = data?.[0]?.period ?? 0;
  return max + 1;
}

function revalidateLessonViews(teacherId: string) {
  revalidatePath(`/laerere/${teacherId}`);
  revalidatePath("/laerere");
  revalidatePath("/timeplan");
  revalidatePath("/fravaer");
  revalidatePath("/");
}

export async function upsertLesson(input: LessonInput): Promise<ActionResult> {
  await requireUser();
  if (input.weekday < 1 || input.weekday > 5)
    return { ok: false, error: "Ugyldig ukedag." };

  const start = nullableText(input.start_time);
  const end = nullableText(input.end_time);
  if (!start || !end) return { ok: false, error: "Start- og sluttid er påkrevd." };
  if (start >= end) return { ok: false, error: "Sluttiden må være etter starttiden." };

  const supabase = await createClient();

  const fields = {
    subject: nullableText(input.subject),
    class_group: nullableText(input.class_group),
    room: nullableText(input.room),
    start_time: start,
    end_time: end,
    activity_type: nullableText(input.activity_type),
  };

  if (input.id) {
    const { error } = await supabase
      .from("lessons")
      .update(fields)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    // New session: assign the next free slot number for this teacher + weekday
    // so the (teacher, weekday, period) key stays unique.
    const period = input.period ?? (await nextPeriod(supabase, input.teacher_id, input.weekday));
    const { error } = await supabase.from("lessons").insert({
      teacher_id: input.teacher_id,
      weekday: input.weekday,
      period,
      ...fields,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidateLessonViews(input.teacher_id);
  return { ok: true };
}

export async function deleteLesson(
  id: string,
  teacherId: string,
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateLessonViews(teacherId);
  return { ok: true };
}
