"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/membership";
import { type ActionResult, requiredText } from "./_common";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Onboarding: create a new school and make the current user its first member. */
export async function createSchool(name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Du er ikke innlogget." };

  const schoolName = requiredText(name);
  if (!schoolName) return { ok: false, error: "Skolenavn er påkrevd." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { ok: false, error: "Du er allerede medlem av en skole." };

  const { data: school, error: sErr } = await admin
    .from("schools")
    .insert({ name: schoolName })
    .select("id")
    .single();
  if (sErr) return { ok: false, error: sErr.message };

  const { error: mErr } = await admin
    .from("memberships")
    .insert({ user_id: user.id, school_id: school!.id, email: user.email });
  if (mErr) return { ok: false, error: mErr.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Onboarding: if the current user's email has a pending invitation, join that
 * school. Returns whether a join happened.
 */
export async function acceptInvite(): Promise<ActionResult<{ joined: boolean }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Du er ikke innlogget." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { ok: true, data: { joined: true } };

  const { data: invite } = await admin
    .from("invitations")
    .select("*")
    .eq("email", user.email.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (!invite) return { ok: true, data: { joined: false } };

  const { error: mErr } = await admin
    .from("memberships")
    .insert({ user_id: user.id, school_id: invite.school_id, email: user.email });
  if (mErr) return { ok: false, error: mErr.message };
  await admin.from("invitations").delete().eq("id", invite.id);

  revalidatePath("/", "layout");
  return { ok: true, data: { joined: true } };
}

/** Invite someone to the current user's school by email. */
export async function inviteMember(email: string): Promise<ActionResult> {
  const membership = await getMembership();
  if (!membership) return { ok: false, error: "Du tilhører ingen skole." };

  const clean = (email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return { ok: false, error: "Ugyldig e-postadresse." };

  const supabase = await createClient();

  // Already a member of this school?
  const { data: existingMember } = await supabase
    .from("memberships")
    .select("id")
    .eq("email", clean)
    .maybeSingle();
  if (existingMember) {
    return { ok: false, error: "Denne personen er allerede medlem." };
  }

  const { error } = await supabase
    .from("invitations")
    .insert({ school_id: membership.school_id, email: clean });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Denne e-posten er allerede invitert." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/medlemmer");
  return { ok: true };
}

/** Remove a member from the school (cannot remove yourself). */
export async function removeMember(membershipId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Du er ikke innlogget." };

  const { data: target } = await supabase
    .from("memberships")
    .select("id, user_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Fant ikke medlemmet." };
  if (target.user_id === user.id) {
    return { ok: false, error: "Du kan ikke fjerne deg selv." };
  }

  const { error } = await supabase.from("memberships").delete().eq("id", membershipId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/medlemmer");
  return { ok: true };
}

/** Cancel a pending invitation. */
export async function cancelInvite(invitationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", invitationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/medlemmer");
  return { ok: true };
}
