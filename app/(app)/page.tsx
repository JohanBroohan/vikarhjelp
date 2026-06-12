import { getTodayBoard } from "@/lib/queries/board";
import { todayISO, formatDateLong, capitalize } from "@/lib/format";
import { Page, PageHeader, Card, ButtonLink } from "@/components/ui";
import { PhoneLink } from "@/components/PhoneLink";
import { LiveBoard } from "./LiveBoard";

export default async function OversiktPage() {
  const today = todayISO();
  const board = await getTodayBoard(today);
  const { summary } = board;

  return (
    <Page>
      <PageHeader
        title="Oversikt"
        description={capitalize(formatDateLong(today))}
        actions={
          <ButtonLink href={`/fravaer?date=${today}`}>+ Registrer fravær</ButtonLink>
        }
      />

      {/* Sick today + vikars at school today */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Syke i dag</h2>
          {board.sick.length === 0 ? (
            <p className="text-sm text-muted">Ingen fravær registrert i dag.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {board.sick.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-red-600/15"
                >
                  {s.name}
                  {s.window && (
                    <span className="font-normal text-red-600/80"> · {s.window.from}–{s.window.to}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Vikarer på skolen i dag</h2>
          {board.vikars.length === 0 ? (
            <p className="text-sm text-muted">Ingen vikarer i dag.</p>
          ) : (
            <ul className="space-y-2">
              {board.vikars.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                  <span className="font-medium text-ink">{v.name}</span>
                  <PhoneLink phone={v.phone} />
                  <span className="text-muted">
                    {v.classes.length} {v.classes.length === 1 ? "time" : "timer"}
                    {": "}
                    {v.classes
                      .map((c) => [c.subject, c.classGroup].filter(Boolean).join(" "))
                      .join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Live timeline */}
      <LiveBoard board={board} />

      {/* Compact coverage summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Timer å dekke" value={summary.total} tone="ink" />
        <SummaryCard label="Dekket" value={summary.covered} tone="green" />
        <SummaryCard label="Venter" value={summary.pending} tone="amber" />
        <SummaryCard label="Udekket" value={summary.uncovered} tone="red" />
      </div>
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
