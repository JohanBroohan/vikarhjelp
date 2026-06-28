import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Page } from "@/components/ui";
import { MembersManager } from "./MembersManager";

export default async function MembersPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, email, user_id, created_at")
      .order("created_at"),
    supabase.from("invitations").select("id, email, created_at").order("created_at"),
  ]);

  return (
    <Page>
      <MembersManager
        members={membersRes.data ?? []}
        invites={invitesRes.data ?? []}
        currentUserId={user.id}
      />
    </Page>
  );
}
