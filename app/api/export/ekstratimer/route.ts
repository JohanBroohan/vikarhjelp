import { type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import {
  absenceTypeLabel,
  SCHOOL_DAY_START,
  SCHOOL_DAY_END,
} from "@/lib/constants";
import { resolveRange } from "@/lib/reports";
import { fetchCoverRows, fetchAbsenceExportRows } from "@/lib/queries/extraHours";

/** Escape a value for CSV (RFC 4180): wrap in quotes, double internal quotes. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Minutes since midnight for an "HH:MM" clock string. */
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Duration in hours between two "HH:MM" times, Norwegian comma decimals. */
function durationHours(start: string, end: string): string {
  const hours = Math.max(0, toMin(end) - toMin(start)) / 60;
  return (Math.round(hours * 100) / 100).toString().replace(".", ",");
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const sp = request.nextUrl.searchParams;
  const range = resolveRange(
    {
      preset: sp.get("preset") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
    },
    todayISO(),
  );
  const teacherId = sp.get("teacher");
  const vikarId = sp.get("vikar");
  const coverer = teacherId
    ? { teacherId }
    : vikarId
      ? { vikarId }
      : undefined;

  // What to include: vikartimer | fravaer | begge (default both).
  const what = sp.get("what") ?? "begge";
  const wantCovers = what === "vikartimer" || what === "begge";
  // Vikars are external and have no absences.
  const wantAbsence = (what === "fravaer" || what === "begge") && !vikarId;

  const [covers, absences] = await Promise.all([
    wantCovers ? fetchCoverRows(range, coverer) : Promise.resolve([]),
    wantAbsence
      ? fetchAbsenceExportRows(range, teacherId ?? undefined)
      : Promise.resolve([]),
  ]);

  interface Row {
    name: string;
    date: string;
    type: string;
    time: string;
    klokkeslett: string;
    varighet: string;
    klasse: string;
    fag: string;
    dekketFor: string;
    fravaerstype: string;
    tidsrom: string;
  }

  const rows: Row[] = [
    ...covers.map((c) => ({
      name: c.coveringName,
      date: c.date,
      type: "Vikartime",
      time: String(c.period),
      klokkeslett: `${c.start}–${c.end}`,
      varighet: durationHours(c.start, c.end),
      klasse: c.classGroup ?? "",
      fag: c.subject ?? "",
      dekketFor: c.absentTeacherName,
      fravaerstype: "",
      tidsrom: "",
    })),
    ...absences.map((a) => {
      const from = a.window?.from ?? SCHOOL_DAY_START;
      const to = a.window?.to ?? SCHOOL_DAY_END;
      return {
        name: a.name,
        date: a.date,
        type: "Fravær",
        time: "",
        klokkeslett: `${from}–${to}`,
        varighet: durationHours(from, to),
        klasse: "",
        fag: "",
        dekketFor: "",
        fravaerstype: absenceTypeLabel(a.absenceType),
        tidsrom: a.window ? `${a.window.from}–${a.window.to}` : "Hele dagen",
      };
    }),
  ].sort((x, y) =>
    x.date < y.date ? 1 : x.date > y.date ? -1 : x.name.localeCompare(y.name, "nb"),
  );

  const header = [
    "Navn",
    "Dato",
    "Type",
    "Time",
    "Klokkeslett",
    "Varighet",
    "Klasse",
    "Fag",
    "Dekket for",
    "Fraværstype",
    "Tidsrom",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.date,
        r.type,
        r.time,
        r.klokkeslett,
        r.varighet,
        r.klasse,
        r.fag,
        r.dekketFor,
        r.fravaerstype,
        r.tidsrom,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  // BOM so Excel reads UTF-8 (æ/ø/å) correctly.
  const body = "﻿" + lines.join("\r\n") + "\r\n";
  const label =
    what === "vikartimer" ? "vikartimer" : what === "fravaer" ? "fravaer" : "historikk";
  const fname = `${label}-${range.from ?? "start"}-${range.to ?? "na"}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
