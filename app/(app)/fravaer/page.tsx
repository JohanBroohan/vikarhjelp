import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/format";
import type { Teacher, Vikar } from "@/lib/database.types";
import { ReportFlow } from "./ReportFlow";

export default async function ReportAbsencePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    teacher?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { date, teacher, from, to } = await searchParams;
  const start = from ?? date ?? todayISO();
  const end = to ?? from ?? date ?? todayISO();
  const supabase = await createClient();

  const [teachersRes, vikarsRes] = await Promise.all([
    supabase.from("teachers").select("*").eq("is_active", true).order("name"),
    supabase.from("vikars").select("*").eq("is_active", true).order("name"),
  ]);

  return (
    <Page>
      <PageHeader
        title="Registrer fravær"
        description="Velg lærer og dato. Vikarhjelp finner ledige lærere for hver time."
      />
      <ReportFlow
        teachers={(teachersRes.data ?? []) as Teacher[]}
        vikars={(vikarsRes.data ?? []) as Vikar[]}
        initialFromDate={start}
        initialToDate={end}
        initialTeacherId={teacher ?? ""}
      />
    </Page>
  );
}
