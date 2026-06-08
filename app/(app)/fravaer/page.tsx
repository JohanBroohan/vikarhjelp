import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/format";
import type { Teacher } from "@/lib/database.types";
import { ReportFlow } from "./ReportFlow";

export default async function ReportAbsencePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; teacher?: string }>;
}) {
  const { date, teacher } = await searchParams;
  const supabase = await createClient();

  const { data: teachers } = await supabase
    .from("teachers")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return (
    <Page>
      <PageHeader
        title="Registrer fravær"
        description="Velg lærer og dato. Vikarhjelp finner ledige lærere for hver time."
      />
      <ReportFlow
        teachers={(teachers ?? []) as Teacher[]}
        initialDate={date ?? todayISO()}
        initialTeacherId={teacher ?? ""}
      />
    </Page>
  );
}
