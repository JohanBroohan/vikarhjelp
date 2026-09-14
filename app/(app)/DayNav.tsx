"use client";

import { useRouter } from "next/navigation";
import { addDaysISO, todayISO, formatDateLong, capitalize } from "@/lib/format";
import { DateField } from "@/components/DateField";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

// White outlined button, matching the Figma "Button menu" (0.5px #bbb, 8px).
const BTN =
  "rounded-lg border border-[#bbb] text-[#030303] transition hover:bg-black/[0.03] dark:border-line dark:text-muted";

export function DayNav({ date, isToday }: { date: string; isToday: boolean }) {
  const router = useRouter();
  const go = (d: string) => router.push(`/?date=${d}`);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => go(addDaysISO(date, -1))}
        aria-label="Forrige dag"
        className={`flex h-8 w-8 items-center justify-center ${BTN}`}
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
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-normal ${BTN} dark:text-ink`}
          >
            {capitalize(formatDateLong(date))}
            <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          </button>
        )}
      />

      <button
        onClick={() => go(addDaysISO(date, 1))}
        aria-label="Neste dag"
        className={`flex h-8 w-8 items-center justify-center ${BTN}`}
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {!isToday && (
        <button
          onClick={() => go(todayISO())}
          className={`px-3 py-1.5 text-sm font-medium ${BTN}`}
        >
          I dag
        </button>
      )}
    </div>
  );
}
