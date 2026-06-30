"use client";

import { useRouter } from "next/navigation";
import { addDaysISO, todayISO, formatDateLong, capitalize } from "@/lib/format";
import { DateField } from "@/components/DateField";

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
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>

      <DateField
        value={date}
        onChange={go}
        trigger={({ toggle }) => (
          <button
            onClick={toggle}
            aria-label="Velg dato"
            className="flex min-w-[230px] items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-lg font-semibold text-ink transition hover:bg-canvas"
          >
            {capitalize(formatDateLong(date))}
            <svg
              className="h-4 w-4 shrink-0 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      />

      <button
        onClick={() => go(addDaysISO(date, 1))}
        aria-label="Neste dag"
        className="rounded-lg p-2 text-muted ring-1 ring-line transition hover:bg-canvas hover:text-ink"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
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
