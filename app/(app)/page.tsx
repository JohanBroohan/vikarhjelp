import Link from "next/link";
import { getDayOverview } from "@/lib/actions/coverage";
import { todayISO, formatDateLong, capitalize, pluralLessons } from "@/lib/format";
import { PERIOD_TIMES } from "@/lib/constants";
import { Page, PageHeader, Card, ButtonLink, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";

export default async function DashboardPage() {
  const today = todayISO();
  const overview = await getDayOverview(today);
  const { summary } = overview;

  return (
    <Page>
      <PageHeader
        title="I dag"
        description={capitalize(formatDateLong(today))}
        actions={
          <ButtonLink href={`/fravaer?date=${today}`}>+ Registrer fravær</ButtonLink>
        }
      />

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Timer å dekke" value={summary.total} tone="ink" />
        <SummaryCard label="Dekket" value={summary.covered} tone="green" />
        <SummaryCard label="Venter" value={summary.pending} tone="amber" />
        <SummaryCard label="Udekket" value={summary.uncovered} tone="red" />
      </div>

      {overview.absences.length === 0 ? (
        <EmptyState
          title="Ingen fravær registrert i dag"
          description="Når en lærer melder seg syk, registrer fraværet så finner Vikarhjelp ledige lærere for hver time."
          action={<ButtonLink href={`/fravaer?date=${today}`}>+ Registrer fravær</ButtonLink>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {overview.absences.map((abs) => (
            <Card key={abs.teacher.id} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                <div>
                  <h2 className="font-semibold text-ink">{abs.teacher.name}</h2>
                  <p className="text-xs text-muted">
                    {abs.window ? `Borte ${abs.window.from}–${abs.window.to} · ` : ""}
                    {abs.reason ? abs.reason + " · " : ""}
                    {pluralLessons(abs.lessons.length)} å dekke
                  </p>
                </div>
                <Link
                  href={`/fravaer?date=${today}&teacher=${abs.teacher.id}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  Rediger dekning
                </Link>
              </div>

              {abs.lessons.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">Ingen timer denne dagen.</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {abs.lessons.map((dl) => (
                    <li key={dl.lesson.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-14 shrink-0">
                        <div className="font-medium text-ink">{dl.lesson.period}.</div>
                        <div className="tabular text-[11px] text-muted">
                          {dl.lesson.start_time ?? PERIOD_TIMES[dl.lesson.period]?.start}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-ink">
                          {dl.lesson.subject ?? "Time"}{" "}
                          <span className="font-normal text-muted">
                            {dl.lesson.class_group ? `· ${dl.lesson.class_group}` : ""}
                            {dl.lesson.room ? ` · ${dl.lesson.room}` : ""}
                          </span>
                        </div>
                        {dl.coveringName && (
                          <div className="truncate text-sm text-emerald-700">
                            Dekkes av {dl.coveringName}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={dl.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ink" | "green" | "amber" | "red";
}) {
  const toneClass = {
    ink: "text-ink",
    green: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }[tone];
  return (
    <Card className="px-4 py-3.5">
      <div className={`text-3xl font-semibold tabular ${toneClass}`}>{value}</div>
      <div className="mt-0.5 text-sm text-muted">{label}</div>
    </Card>
  );
}
