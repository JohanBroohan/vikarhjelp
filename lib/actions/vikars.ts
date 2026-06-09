"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { type ActionResult, nullableText, requiredText } from "./_common";

export interface VikarInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  is_active?: boolean;
  unavailable_weekdays?: number[];
}

/** Keep only valid weekday numbers (1–5), de-duplicated and sorted. */
function sanitizeWeekdays(days?: number[]): number[] {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 5))].sort();
}

function revalidateVikarViews() {
  revalidatePath("/vikarer");
  revalidatePath("/fravaer");
}

export async function createVikar(input: VikarInput): Promise<ActionResult> {
  await requireUser();
  const name = requiredText(input.name);
  if (!name) return { ok: false, error: "Navn er påkrevd." };

  const supabase = await createClient();
  const { error } = await supabase.from("vikars").insert({
    name,
    phone: nullableText(input.phone),
    email: nullableText(input.email),
    notes: nullableText(input.notes),
    is_active: input.is_active ?? true,
    unavailable_weekdays: sanitizeWeekdays(input.unavailable_weekdays),
  });
  if (error) return { ok: false, error: error.message };

  revalidateVikarViews();
  return { ok: true };
}

export async function updateVikar(
  id: string,
  input: VikarInput,
): Promise<ActionResult> {
  await requireUser();
  const name = requiredText(input.name);
  if (!name) return { ok: false, error: "Navn er påkrevd." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("vikars")
    .update({
      name,
      phone: nullableText(input.phone),
      email: nullableText(input.email),
      notes: nullableText(input.notes),
      unavailable_weekdays: sanitizeWeekdays(input.unavailable_weekdays),
      ...(input.is_active === undefined ? {} : { is_active: input.is_active }),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateVikarViews();
  return { ok: true };
}

export async function setVikarActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("vikars")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateVikarViews();
  return { ok: true };
}

export async function deleteVikar(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("vikars").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateVikarViews();
  return { ok: true };
}
