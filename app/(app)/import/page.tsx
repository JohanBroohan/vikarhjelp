import { Page, PageHeader } from "@/components/ui";
import { ImportClient } from "./ImportClient";

export default function ImportPage() {
  return (
    <Page>
      <PageHeader
        title="Importer timeplan"
        description="Last opp en Excel- eller CSV-fil med timeplanen. Du får en forhåndsvisning før noe lagres."
      />
      <ImportClient />
    </Page>
  );
}
