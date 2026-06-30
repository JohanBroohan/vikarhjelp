import Link from "next/link";
import { Page, PageHeader, Card, EmptyState } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { resolveRange, rangeToQuery } from "@/lib/reports";
import { fetchTeacherTotals } from "@/lib/queries/extraHours";
import { RangeFilter } from "./RangeFilter";

export default async function ExtraHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = resolveRange(params, todayISO());
  const query = rangeToQuery(range);

  const totals = await fetchTeacherTotals(range);
  const grandTotal = totals.reduce((s, t) => s + t.total, 0);
  const grandUnsettled = totals.reduce((s, t) => s + t.unsettled, 0);

  return (
    <Page>
      <PageHeader
        title="Historikk"
        description="Vikartimer dekket og dager med fravær per ansatt. Marker vikartimer som oppgjort når de er kompensert."
        actions={
          <a
            href={`/api/export/ekstratimer?${query}`}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-brand-700 ring-1 ring-line hover:bg-brand-50"
          >
            Eksporter CSV
          </a>
        }
      />

      <div className="mb-5">
        <RangeFilter range={range} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="px-4 py-3.5">
          <div className="text-3xl font-semibold tabular text-ink">{grandTotal}</div>
          <div className="text-sm text-muted">Vikartimer totalt</div>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-3xl font-semibold tabular text-amber-700">{grandUnsettled}</div>
          <div className="text-sm text-muted">Utestående (ikke oppgjort)</div>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-3xl font-semibold tabular text-emerald-700">
            {grandTotal - grandUnsettled}
          </div>
          <div className="text-sm text-muted">Oppgjort</div>
        </Card>
      </div>

      {totals.length === 0 ? (
        <EmptyState
          title="Ingen vikartimer eller fravær i denne perioden"
          description="Når ansatte dekker timer for hverandre eller har fravær, dukker de opp her."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Ansatt</th>
                  <th className="px-4 py-3 text-right font-medium">Vikartimer</th>
                  <th className="px-4 py-3 text-right font-medium">Oppgjort</th>
                  <th className="px-4 py-3 text-right font-medium">Utestående</th>
                  <th className="px-4 py-3 text-right font-medium">Fravær</th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {totals.map((t) => (
                  <tr key={`${t.kind}-${t.id}`} className="border-b border-line/70 last:border-0 hover:bg-canvas/50">
                    <td className="px-4 py-3 font-medium text-ink">
                      {t.name}
                      {t.kind === "vikar" && (
                        <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                          Vikar
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-ink">{t.total}</td>
                    <td className="px-4 py-3 text-right tabular text-emerald-700">{t.settled}</td>
                    <td className="px-4 py-3 text-right tabular text-amber-700">{t.unsettled}</td>
                    <td className="px-4 py-3 text-right tabular text-muted">
                      {t.kind === "vikar" ? "—" : t.absenceDays}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/ekstratimer/${t.id}?${query}${t.kind === "vikar" ? "&kind=vikar" : ""}`}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                      >
                        Se detaljer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}
