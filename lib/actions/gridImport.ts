"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { parseGridBuffer } from "@/lib/import/parseGrid";
import type { GridEntry, GridParseResult } from "@/lib/import/parseGrid";
import type { ActionResult } from "./_common";

export type { GridEntry, GridParseResult };

/** Parse an exported per-teacher timetable grid (.xlsx/.csv). */
export async function parseTeacherGrid(
  formData: FormData,
): Promise<ActionResult<GridParseResult>> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Ingen fil ble lastet opp." };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  return parseGridBuffer(buf);
}

export interface CommitGridInput {
  /** Existing teacher to assign this schedule to … */
  teacherId?: string;
  /** … or a new teacher name to create. */
  newTeacherName?: string;
  entries: GridEntry[];
}

/** Replace one teacher's whole weekly schedule with the parsed grid. */
export async function commitTeacherGrid(
  input: CommitGridInput,
): Promise<ActionResult<{ teacherId: string; inserted: number; created: boolean }>> {
  await requireUser();
  const supabase = await createClient();

  let teacherId = input.teacherId;
  let created = false;
  if (!teacherId) {
    const name = input.newTeacherName?.trim();
    if (!name) return { ok: false, error: "Velg en lærer eller skriv inn et navn." };
    const { data, error } = await supabase
      .from("teachers")
      .insert({ name })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    teacherId = data!.id;
    created = true;
  }

  // Replace: clear this teacher's existing lessons, then insert the grid.
  const { error: delErr } = await supabase
    .from("lessons")
    .delete()
    .eq("teacher_id", teacherId);
  if (delErr) return { ok: false, error: delErr.message };

  // Guard against duplicate (weekday, period) rows — Postgres rejects an upsert
  // that would touch the same conflict key twice ("cannot affect row a second
  // time"). Keep the first occurrence of each slot.
  const seenSlots = new Set<string>();
  const rows = input.entries
    .filter((e) => {
      const slot = `${e.weekday}-${e.period}`;
      if (seenSlots.has(slot)) return false;
      seenSlots.add(slot);
      return true;
    })
    .map((e) => ({
      teacher_id: teacherId!,
      weekday: e.weekday,
      period: e.period,
      start_time: e.start,
      end_time: e.end,
      subject: e.subject,
      class_group: e.classGroup,
      activity_type: e.activityType,
      room: null,
    }));
  const { error: insErr } = await supabase
    .from("lessons")
    .upsert(rows, { onConflict: "teacher_id,weekday,period" });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/laerere");
  revalidatePath("/timeplan");
  revalidatePath("/");
  return { ok: true, data: { teacherId: teacherId!, inserted: rows.length, created } };
}
