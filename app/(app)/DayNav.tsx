"use client";

import { useRouter } from "next/navigation";
import { addDaysISO, todayISO, formatDateLong, capitalize } from "@/lib/format";
import { DateField } from "@/components/DateField";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

export function DayNav({ date, isToday }: { date: string; isToday: boolean }) {
  const router = useRouter();
  const go = (d: string) => router.push(`/?date=${d}`);

  return (
    <div className="mb-3 flex items-center gap-2">
      <button
        onClick={() => go(addDaysISO(date, -1))}
        aria-label="Forrige dag"
        className="rounded-lg p-2 text-muted ring-1 ring-line transition hover:bg-canvas hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
      </button>

      <DateField
        value={date}
        onChange={go}
        trigger={({ toggle }) => (
          <button
            onClick={toggle}
            aria-label="Velg dato"
            className="flex min-w-[230px] items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-lg font-medium text-ink transition hover:bg-canvas"
          >
            {capitalize(formatDateLong(date))}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
          </button>
        )}
      />

      <button
        onClick={() => go(addDaysISO(date, 1))}
        aria-label="Neste dag"
        className="rounded-lg p-2 text-muted ring-1 ring-line transition hover:bg-canvas hover:text-ink"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2} />
      </button>

      {!isToday && (
        <button
          onClick={() => go(todayISO())}
          className="ml-1 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-line transition hover:bg-brand-50"
        >
          I dag
        </button>
      )}
    </div>
  );
}
