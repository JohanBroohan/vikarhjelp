import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/ui";
import type { Teacher } from "@/lib/database.types";
import { TeachersManager } from "./TeachersManager";

export default async function TeachersPage() {
  const supabase = await createClient();

  const { data: teachers } = await supabase
    .from("teachers")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  return (
    <Page>
      <PageHeader
        title="Ansatte"
        description="Administrer ansatte og deres ukentlige timeplan."
      />
      <TeachersManager teachers={(teachers ?? []) as Teacher[]} />
    </Page>
  );
}
