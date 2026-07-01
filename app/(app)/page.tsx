import Link from "next/link";
import { getTodayBoard } from "@/lib/queries/board";
import { todayISO, formatDayMonth } from "@/lib/format";
import { Page, Card } from "@/components/ui";
import { PhoneLink } from "@/components/PhoneLink";
import { Pencil, CalendarDays } from "lucide-react";
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
            <h2 className="mb-4 text-base font-normal text-ink">Fravær i dag</h2>
            {board.sick.length === 0 ? (
              <p className="text-sm text-muted">Ingen fravær registrert i dag.</p>
            ) : (
              <ul className="space-y-3">
                {board.sick.map((s) => (
                  <li
                    key={s.id}
                    className="relative space-y-0.5 border-b border-line/60 pb-3 pl-3 last:border-0 last:pb-0"
                  >
                    <span className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-full bg-red-500" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{s.name}</span>
                      <Link
                        href={
                          s.range
                            ? `/fravaer?teacher=${s.id}&from=${s.range.from}&to=${s.range.to}`
                            : `/fravaer?date=${board.date}&teacher=${s.id}`
                        }
                        aria-label={`Endre fravær for ${s.name}`}
                        title="Endre fravær"
                        className="rounded-md p-1 text-[#527dd8] transition hover:bg-canvas"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </Link>
                    </div>
                    {s.range && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.8} />
                        <span>
                          Borte {formatDayMonth(s.range.from)} – {formatDayMonth(s.range.to)}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
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
            <h2 className="mb-4 text-base font-normal text-ink">
              Vikarer på skolen i dag
            </h2>
            {board.vikars.length === 0 ? (
              <p className="text-sm text-muted">Ingen vikarer i dag.</p>
            ) : (
              <ul className="space-y-3">
                {board.vikars.map((v) => (
                  <li
                    key={v.id}
                    className="relative space-y-0.5 border-b border-line/60 pb-2.5 pl-3 last:border-0 last:pb-0"
                  >
                    <span className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-full bg-[#6a29df] dark:bg-[#9e7ae1]" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{v.name}</span>
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
