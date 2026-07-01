"use client";

import { useRouter } from "next/navigation";
import { addDaysISO, todayISO, formatDateLong, capitalize } from "@/lib/format";
import { DateField } from "@/components/DateField";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

const ARROW =
  "flex h-[22px] w-[22px] items-center justify-center rounded-md bg-black/[0.04] text-[#4b4b4b] transition hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-muted dark:hover:bg-white/[0.1]";

export function DayNav({ date, isToday }: { date: string; isToday: boolean }) {
  const router = useRouter();
  const go = (d: string) => router.push(`/?date=${d}`);

  return (
    <div className="mb-3 flex items-center gap-4">
      <button
        onClick={() => go(addDaysISO(date, -1))}
        aria-label="Forrige dag"
        className={ARROW}
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      <DateField
        value={date}
        onChange={go}
        trigger={({ toggle }) => (
          <button
            onClick={toggle}
            aria-label="Velg dato"
            className="flex items-center gap-1 rounded-md px-1 py-1 text-base font-normal text-ink transition hover:bg-canvas"
          >
            {capitalize(formatDateLong(date))}
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 text-[#4b4b4b] dark:text-muted"
              strokeWidth={2}
            />
          </button>
        )}
      />

      <button
        onClick={() => go(addDaysISO(date, 1))}
        aria-label="Neste dag"
        className={ARROW}
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {!isToday && (
        <button
          onClick={() => go(todayISO())}
          className="rounded-xl px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-line transition hover:bg-brand-50"
        >
          I dag
        </button>
      )}
    </div>
  );
}
