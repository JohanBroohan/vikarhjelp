import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Page, PageHeader } from "@/components/ui";
import { SettingsTabs } from "./SettingsTabs";

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [membersRes, invitesRes, schoolRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, email, user_id, first_name, last_name, created_at")
      .order("created_at"),
    supabase.from("invitations").select("id, email, created_at").order("created_at"),
    supabase.from("schools").select("name").limit(1).maybeSingle(),
  ]);

  const members = membersRes.data ?? [];
  const me = members.find((m) => m.user_id === user.id);

  return (
    <Page>
      <PageHeader title="Innstillinger" />
      <SettingsTabs
        members={members}
        invites={invitesRes.data ?? []}
        currentUserId={user.id}
        email={user.email ?? ""}
        firstName={me?.first_name ?? ""}
        lastName={me?.last_name ?? ""}
        schoolName={schoolRes.data?.name ?? "Skolen"}
      />
    </Page>
  );
}
