import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/ui";
import type { Vikar } from "@/lib/database.types";
import { VikarsManager } from "./VikarsManager";

export default async function VikarsPage() {
  const supabase = await createClient();
  const { data: vikars } = await supabase
    .from("vikars")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  return (
    <Page>
      <PageHeader
        title="Vikarer"
        description="Eksterne vikarer å ringe når ingen lærer er ledig."
      />
      <VikarsManager vikars={(vikars ?? []) as Vikar[]} />
    </Page>
  );
}
