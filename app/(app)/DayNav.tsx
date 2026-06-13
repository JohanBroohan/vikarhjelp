"use client";

import { useRouter } from "next/navigation";
import { addDaysISO, todayISO, formatDateLong, capitalize } from "@/lib/format";

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

      <div className="min-w-[230px] text-center text-lg font-semibold text-ink">
        {capitalize(formatDateLong(date))}
      </div>

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
          className="ml-1 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-line transition hover:bg-brand-50"
        >
          I dag
        </button>
      )}
    </div>
  );
}
