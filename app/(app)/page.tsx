import Link from "next/link";
import { getTodayBoard } from "@/lib/queries/board";
import { todayISO, formatDayMonth } from "@/lib/format";
import { Page, Card } from "@/components/ui";
import { PhoneLink } from "@/components/PhoneLink";
import { LiveBoard } from "./LiveBoard";
import { DayNav } from "./DayNav";

export default async function OversiktPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const today = todayISO();
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const isToday = date === today;
  const board = await getTodayBoard(date);

  return (
    <Page fluid>
      {/* Compact day navigation (read-only screen, so no other actions). */}
      <DayNav date={date} isToday={isToday} />

      {/* Large screens: timeline left, sick + vikars stacked on the right. */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <LiveBoard board={board} isToday={isToday} />
        </div>

        {/* On today the timeline shows a live-clock headline above its card;
            offset the right column to align with the card. On other days there
            is no headline, so no offset. */}
        <div className={`space-y-4 ${isToday ? "xl:mt-12" : ""}`}>
          <Card className="p-4">
            <h2 className="mb-4 text-base font-semibold text-ink">Fravær i dag</h2>
            {board.sick.length === 0 ? (
              <p className="text-sm text-muted">Ingen fravær registrert i dag.</p>
            ) : (
              <ul className="space-y-2.5">
                {board.sick.map((s) => (
                  <li
                    key={s.id}
                    className="space-y-[3px] border-b border-line/60 pb-2.5 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium text-ink">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        {s.name}
                      </span>
                      <Link
                        href={
                          s.range
                            ? `/fravaer?teacher=${s.id}&from=${s.range.from}&to=${s.range.to}`
                            : `/fravaer?date=${board.date}&teacher=${s.id}`
                        }
                        aria-label={`Endre fravær for ${s.name}`}
                        title="Endre fravær"
                        className="rounded-md p-1 text-muted transition hover:bg-canvas hover:text-brand-700"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </Link>
                    </div>
                    {s.range && (
                      <div className="flex items-center gap-1.5 pl-3.5 text-xs font-medium text-amber-700">
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        <span>
                          Borte {formatDayMonth(s.range.from)} – {formatDayMonth(s.range.to)}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-3.5 text-xs">
                      <span className="tabular text-muted">
                        {s.window ? `${s.window.from}–${s.window.to}` : "Hele dagen"}
                      </span>
                      <span className="text-emerald-700">{s.covered} dekket</span>
                      <span
                        className={
                          s.uncovered > 0 ? "font-medium text-red-700" : "text-muted"
                        }
                      >
                        {s.uncovered} udekket
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-4 text-base font-semibold text-ink">
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
