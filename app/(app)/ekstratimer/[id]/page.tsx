import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader, Card, EmptyState } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { resolveRange, rangeToQuery, RANGE_LABELS } from "@/lib/reports";
import { fetchCoverRows, fetchAbsenceRows } from "@/lib/queries/extraHours";
import { HistoryList } from "./HistoryList";
import { ExportCsvMenu } from "../ExportCsvMenu";

export default async function TeacherExtraHoursPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preset?: string; from?: string; to?: string; kind?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const range = resolveRange(sp, todayISO());
  const query = rangeToQuery(range);
  const isVikar = sp.kind === "vikar";

  const supabase = await createClient();
  const { data: person } = await supabase
    .from(isVikar ? "vikars" : "teachers")
    .select("id, name")
    .eq("id", id)
    .single();
  if (!person) notFound();

  const rows = await fetchCoverRows(
    range,
    isVikar ? { vikarId: id } : { teacherId: id },
  );
  // Only staff (teachers) have absences; vikars are external.
  const absences = isVikar ? [] : await fetchAbsenceRows(range, id);
  const exportSuffix = isVikar ? `&vikar=${id}` : `&teacher=${id}`;

  return (
    <Page>
      <div className="mb-2">
        <Link href={`/ekstratimer?${query}`} className="text-sm text-muted hover:text-ink">
          ← Tilbake til historikk
        </Link>
      </div>
      <PageHeader
        title={person.name}
        description={`Fravær og vikartimer · ${RANGE_LABELS[range.preset]}`}
        actions={
          <ExportCsvMenu
            query={query}
            suffix={exportSuffix}
            absencesAvailable={!isVikar}
          />
        }
      />

      {rows.length === 0 && absences.length === 0 ? (
        <EmptyState
          title="Ingen fravær eller vikartimer i denne perioden"
          description="Velg et annet tidsrom for å se flere."
        />
      ) : (
        <Card className="overflow-hidden">
          <HistoryList covers={rows} absences={absences} />
        </Card>
      )}
    </Page>
  );
}
