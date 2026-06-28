// Server-side helpers for the current user's school membership.

import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import type { Membership } from "./database.types";

/** The current user's membership, or null if they haven't joined a school. */
export async function getMembership(): Promise<Membership | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("memberships")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as Membership | null) ?? null;
}

/**
 * A pending invitation for an email, with the inviting school's name. Read with
 * the service role because the invitee has no membership (and thus no RLS
 * access to the invitations table) until they join.
 */
export async function getPendingInvite(
  email: string | null | undefined,
): Promise<{ schoolId: string; schoolName: string } | null> {
  if (!email) return null;
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invitations")
    .select("school_id")
    .eq("email", email.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (!invite) return null;
  const { data: school } = await admin
    .from("schools")
    .select("name")
    .eq("id", invite.school_id)
    .single();
  return { schoolId: invite.school_id, schoolName: school?.name ?? "skolen" };
}
