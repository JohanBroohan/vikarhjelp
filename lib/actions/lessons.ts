"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { PERIOD_COUNT } from "@/lib/constants";
import { type ActionResult, nullableText } from "./_common";

export interface LessonInput {
  id?: string;
  teacher_id: string;
  weekday: number;
  period: number;
  subject?: string | null;
  class_group?: string | null;
  room?: string | null;
  start_time?: string | null;
  end_time?: string | null;
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
  if (input.period < 1 || input.period > PERIOD_COUNT)
    return { ok: false, error: "Ugyldig time." };

  const supabase = await createClient();
  const row = {
    teacher_id: input.teacher_id,
    weekday: input.weekday,
    period: input.period,
    subject: nullableText(input.subject),
    class_group: nullableText(input.class_group),
    room: nullableText(input.room),
    start_time: nullableText(input.start_time),
    end_time: nullableText(input.end_time),
  };

  // One lesson per teacher+weekday+period — upsert on that key so re-saving a
  // slot edits it instead of erroring on the unique constraint.
  const { error } = input.id
    ? await supabase.from("lessons").update(row).eq("id", input.id)
    : await supabase
        .from("lessons")
        .upsert(row, { onConflict: "teacher_id,weekday,period" });
  if (error) return { ok: false, error: error.message };

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
