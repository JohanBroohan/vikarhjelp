import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader, Card, EmptyState } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { resolveRange, rangeToQuery, RANGE_LABELS } from "@/lib/reports";
import { fetchCoverRows } from "@/lib/queries/extraHours";
import { CoverList } from "./CoverList";

export default async function TeacherExtraHoursPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const range = resolveRange(sp, todayISO());
  const query = rangeToQuery(range);

  const supabase = await createClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, name")
    .eq("id", id)
    .single();
  if (!teacher) notFound();

  const rows = await fetchCoverRows(range, id);

  return (
    <Page>
      <div className="mb-2">
        <Link href={`/ekstratimer?${query}`} className="text-sm text-muted hover:text-ink">
          ← Tilbake til historikk
        </Link>
      </div>
      <PageHeader
        title={teacher.name}
        description={`Ekstratimer · ${RANGE_LABELS[range.preset]}`}
        actions={
          <a
            href={`/api/export/ekstratimer?${query}&teacher=${id}`}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-brand-700 ring-1 ring-line hover:bg-brand-50"
          >
            Eksporter CSV
          </a>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Ingen ekstratimer i denne perioden"
          description="Velg et annet tidsrom for å se flere."
        />
      ) : (
        <Card className="overflow-hidden">
          <CoverList rows={rows} />
        </Card>
      )}
    </Page>
  );
}
