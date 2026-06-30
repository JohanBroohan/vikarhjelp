"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/membership";
import { type ActionResult, requiredText, nullableText } from "./_common";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Best-effort base URL of the running app (for the invite link redirect). */
async function appOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/** Onboarding: create a new school and make the current user its first member. */
export async function createSchool(
  name: string,
  firstName: string,
  lastName: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Du er ikke innlogget." };

  const schoolName = requiredText(name);
  if (!schoolName) return { ok: false, error: "Skolenavn er påkrevd." };
  if (!requiredText(firstName) || !requiredText(lastName)) {
    return { ok: false, error: "Fornavn og etternavn er påkrevd." };
  }

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

  const { error: mErr } = await admin.from("memberships").insert({
    user_id: user.id,
    school_id: school!.id,
    email: user.email,
    first_name: nullableText(firstName),
    last_name: nullableText(lastName),
  });
  if (mErr) return { ok: false, error: mErr.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Onboarding: if the current user's email has a pending invitation, join that
 * school. Returns whether a join happened.
 */
export async function acceptInvite(
  firstName?: string,
  lastName?: string,
  role?: string,
): Promise<ActionResult<{ joined: boolean }>> {
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

  const { error: mErr } = await admin.from("memberships").insert({
    user_id: user.id,
    school_id: invite.school_id,
    email: user.email,
    first_name: nullableText(firstName),
    last_name: nullableText(lastName),
    role: nullableText(role),
  });
  if (mErr) return { ok: false, error: mErr.message };
  await admin.from("invitations").delete().eq("id", invite.id);

  revalidatePath("/", "layout");
  return { ok: true, data: { joined: true } };
}

/** Update the current user's own first/last name. */
export async function updateProfile(
  firstName: string,
  lastName: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Du er ikke innlogget." };
  if (!requiredText(firstName) || !requiredText(lastName)) {
    return { ok: false, error: "Fornavn og etternavn er påkrevd." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .update({
      first_name: nullableText(firstName),
      last_name: nullableText(lastName),
    })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/innstillinger");
  return { ok: true };
}

/** Rename the current user's school. */
export async function renameSchool(name: string): Promise<ActionResult> {
  const membership = await getMembership();
  if (!membership) return { ok: false, error: "Du tilhører ingen skole." };

  const clean = requiredText(name);
  if (!clean) return { ok: false, error: "Skolenavn er påkrevd." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("schools")
    .update({ name: clean })
    .eq("id", membership.school_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/innstillinger");
  return { ok: true };
}

/**
 * Invite someone to the current user's school by email. Records the invitation
 * (the school link that `acceptInvite` consumes) and sends a Supabase invite
 * email with a link to set a password and join.
 */
export async function inviteMember(
  email: string,
): Promise<ActionResult<{ emailSent: boolean }>> {
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

  // Record the school link (used when they finish onboarding).
  const { error } = await supabase
    .from("invitations")
    .insert({ school_id: membership.school_id, email: clean });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Denne e-posten er allerede invitert." };
    }
    return { ok: false, error: error.message };
  }

  // Send the invite email (best-effort: the invitation still works via normal
  // sign-up if email delivery isn't configured, or the person already exists).
  let emailSent = false;
  try {
    const admin = createAdminClient();
    const origin = await appOrigin();
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(clean, {
      redirectTo: `${origin}/velg-passord`,
    });
    emailSent = !inviteErr;
  } catch {
    emailSent = false;
  }

  revalidatePath("/innstillinger");
  return { ok: true, data: { emailSent } };
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

  revalidatePath("/innstillinger");
  return { ok: true };
}

/** Cancel a pending invitation. */
export async function cancelInvite(invitationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", invitationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/innstillinger");
  return { ok: true };
}
