"use client";

import { useRouter } from "next/navigation";
import { addDaysISO, todayISO, formatDateLong, capitalize } from "@/lib/format";
import { DateField } from "@/components/DateField";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

const ARROW =
  "flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-surface text-ink ring-1 ring-line transition hover:bg-canvas dark:text-muted";

export function DayNav({ date, isToday }: { date: string; isToday: boolean }) {
  const router = useRouter();
  const go = (d: string) => router.push(`/?date=${d}`);

  return (
    <div className="flex items-center gap-4">
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
          className="rounded-lg bg-surface px-3 py-1.5 text-sm font-medium text-ink ring-1 ring-line transition hover:bg-canvas"
        >
          I dag
        </button>
      )}
    </div>
  );
}
