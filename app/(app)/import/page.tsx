import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/ui";
import { ImportTabs } from "./ImportTabs";

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, name")
    .order("name");

  return (
    <Page>
      <div className="mb-2">
        <Link href="/timeplan" className="text-sm text-muted hover:text-ink">
          ← Tilbake til timeplan
        </Link>
      </div>
      <PageHeader
        title="Importer timeplan"
        description="Last opp én lærers timeplan-rutenett (eksportert til Excel/CSV), eller en samlet liste. Du får en forhåndsvisning før noe lagres."
      />
      <ImportTabs teachers={(teachers ?? []) as { id: string; name: string }[]} />
    </Page>
  );
}
