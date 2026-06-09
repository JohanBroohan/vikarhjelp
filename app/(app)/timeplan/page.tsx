import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader, ButtonLink } from "@/components/ui";
import type { Lesson, Teacher } from "@/lib/database.types";
import { TimetableView } from "./TimetableView";

export default async function TimetablePage() {
  const supabase = await createClient();
  const [teachersRes, lessonsRes] = await Promise.all([
    supabase.from("teachers").select("*").order("name"),
    supabase.from("lessons").select("*").order("weekday").order("period"),
  ]);

  return (
    <Page>
      <PageHeader
        title="Timeplan"
        description="Hele skolens timeplan. Filtrer på lærer eller se alt samlet. Redigering skjer på lærersiden."
        actions={
          <ButtonLink href="/import" variant="secondary">
            Importer timeplan
          </ButtonLink>
        }
      />
      <TimetableView
        teachers={(teachersRes.data ?? []) as Teacher[]}
        lessons={(lessonsRes.data ?? []) as Lesson[]}
      />
    </Page>
  );
}
