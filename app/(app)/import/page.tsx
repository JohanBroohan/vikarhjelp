import Link from "next/link";
import { Page, PageHeader } from "@/components/ui";
import { ImportClient } from "./ImportClient";

export default function ImportPage() {
  return (
    <Page>
      <div className="mb-2">
        <Link href="/timeplan" className="text-sm text-muted hover:text-ink">
          ← Tilbake til timeplan
        </Link>
      </div>
      <PageHeader
        title="Importer timeplan"
        description="Last opp en Excel- eller CSV-fil med timeplanen. Du får en forhåndsvisning før noe lagres."
      />
      <ImportClient />
    </Page>
  );
}
