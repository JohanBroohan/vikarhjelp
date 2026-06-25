"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { EMPLOYEE_ROLES, DEFAULT_EMPLOYEE_ROLE } from "@/lib/constants";
import { type ActionResult, nullableText, requiredText } from "./_common";

export interface TeacherInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean;
  role?: string;
}

/** Validate a role slug against the known list; fall back to the default. */
function safeRole(role: string | undefined): string {
  return EMPLOYEE_ROLES.some((r) => r.value === role)
    ? role!
    : DEFAULT_EMPLOYEE_ROLE;
}

function revalidateTeacherViews() {
  revalidatePath("/laerere");
  revalidatePath("/timeplan");
  revalidatePath("/fravaer");
  revalidatePath("/");
}

export async function createTeacher(input: TeacherInput): Promise<ActionResult> {
  await requireUser();
  const name = requiredText(input.name);
  if (!name) return { ok: false, error: "Navn er påkrevd." };

  const supabase = await createClient();
  const { error } = await supabase.from("teachers").insert({
    name,
    phone: nullableText(input.phone),
    email: nullableText(input.email),
    is_active: input.is_active ?? true,
    role: safeRole(input.role),
  });
  if (error) return { ok: false, error: error.message };

  revalidateTeacherViews();
  return { ok: true };
}

export async function updateTeacher(
  id: string,
  input: TeacherInput,
): Promise<ActionResult> {
  await requireUser();
  const name = requiredText(input.name);
  if (!name) return { ok: false, error: "Navn er påkrevd." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("teachers")
    .update({
      name,
      phone: nullableText(input.phone),
      email: nullableText(input.email),
      ...(input.role === undefined ? {} : { role: safeRole(input.role) }),
      ...(input.is_active === undefined ? {} : { is_active: input.is_active }),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateTeacherViews();
  return { ok: true };
}

export async function setTeacherActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("teachers")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateTeacherViews();
  return { ok: true };
}

export async function deleteTeacher(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("teachers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateTeacherViews();
  return { ok: true };
}
