"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "./_common";

/** Mark a set of coverage assignments as settled / unsettled (paid). */
export async function setSettled(
  assignmentIds: string[],
  settled: boolean,
): Promise<ActionResult> {
  await requireUser();
  if (assignmentIds.length === 0) return { ok: true };

  const supabase = await createClient();
  // settled_at uses the DB clock so it's consistent regardless of client TZ.
  const { error } = await supabase
    .from("coverage_assignments")
    .update({
      is_settled: settled,
      settled_at: settled ? new Date().toISOString() : null,
    })
    .in("id", assignmentIds);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/ekstratimer");
  return { ok: true };
}
