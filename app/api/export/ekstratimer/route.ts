import { type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { resolveRange } from "@/lib/reports";
import { fetchCoverRows } from "@/lib/queries/extraHours";

/** Escape a value for CSV (RFC 4180): wrap in quotes, double internal quotes. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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

  const rows = await fetchCoverRows(range, coverer);

  const header = ["Navn", "Dato", "Time", "Klasse", "Fag", "Dekket for", "Oppgjort"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.coveringName),
        csvCell(r.date),
        csvCell(r.period),
        csvCell(r.classGroup ?? ""),
        csvCell(r.subject ?? ""),
        csvCell(r.absentTeacherName),
        csvCell(r.isSettled ? "Ja" : "Nei"),
      ].join(","),
    );
  }

  // BOM so Excel reads UTF-8 (æ/ø/å) correctly.
  const body = "﻿" + lines.join("\r\n") + "\r\n";
  const fname = `ekstratimer-${range.from ?? "start"}-${range.to ?? "na"}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
