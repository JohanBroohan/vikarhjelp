import { getTodayBoard } from "@/lib/queries/board";
import { todayISO, formatDateLong, capitalize } from "@/lib/format";
import { Page, PageHeader, Card } from "@/components/ui";
import { PhoneLink } from "@/components/PhoneLink";
import { LiveBoard } from "./LiveBoard";

export default async function OversiktPage() {
  const today = todayISO();
  const board = await getTodayBoard(today);

  return (
    <Page fluid>
      {/* No "Registrer fravær" action here — this screen is shown on the
          faculty-lounge TV, so it stays read-only. */}
      <PageHeader title="Oversikt" description={capitalize(formatDateLong(today))} />

      {/* Large screens: timeline left, sick + vikars stacked on the right. */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <LiveBoard board={board} />
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink">Syke i dag</h2>
            {board.sick.length === 0 ? (
              <p className="text-sm text-muted">Ingen fravær registrert i dag.</p>
            ) : (
              <ul className="space-y-1.5">
                {board.sick.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 border-b border-line/60 pb-1.5 text-sm last:border-0 last:pb-0"
                  >
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      {s.name}
                    </span>
                    {s.window && (
                      <span className="tabular text-xs text-red-600">
                        {s.window.from}–{s.window.to}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink">
              Vikarer på skolen i dag
            </h2>
            {board.vikars.length === 0 ? (
              <p className="text-sm text-muted">Ingen vikarer i dag.</p>
            ) : (
              <ul className="space-y-2.5">
                {board.vikars.map((v) => (
                  <li
                    key={v.id}
                    className="space-y-0.5 border-b border-line/60 pb-2.5 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{v.name}</span>
                      <PhoneLink phone={v.phone} className="text-xs" />
                    </div>
                    <div className="text-xs text-muted">
                      {v.classes
                        .map((c) => [c.subject, c.classGroup].filter(Boolean).join(" "))
                        .join(", ")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}
