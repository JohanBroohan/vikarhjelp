import { createClient } from "@/lib/supabase/server";
import { Page } from "@/components/ui";
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
      <VikarsManager vikars={(vikars ?? []) as Vikar[]} />
    </Page>
  );
}
