"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { WEEKDAY_SHORT } from "@/lib/constants";
import {
  parseImport,
  commitImport,
  type ParseResult,
  type ParsedRow,
} from "@/lib/actions/import";

export function ImportClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ inserted: number; createdTeachers: number } | null>(null);

  const [createMissing, setCreateMissing] = useState(true);
  const [replaceExisting, setReplaceExisting] = useState(true);

  const [parsing, startParse] = useTransition();
  const [committing, startCommit] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setResult(null);
    setDone(null);
    const fd = new FormData();
    fd.set("file", file);
    startParse(async () => {
      const res = await parseImport(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data!);
    });
  }

  function commit() {
    if (!result) return;
    setError(null);
    startCommit(async () => {
      const res = await commitImport(result.rows, {
        createMissingTeachers: createMissing,
        replaceExisting,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(res.data!);
      setResult(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Upload + template */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-ink">Velg fil</p>
            <p className="text-sm text-muted">
              Godtatte kolonner: teacher_name, weekday (1–5 eller man/tir/ons/tor/fre),
              period, subject, class_group, room.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/template"
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-brand-700 ring-1 ring-line hover:bg-brand-50"
            >
              Last ned mal
            </a>
            <Button onClick={() => fileRef.current?.click()} disabled={parsing}>
              {parsing ? "Leser fil …" : "Last opp fil"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
        </div>
        {fileName && (
          <p className="mt-3 text-sm text-muted">
            Valgt fil: <span className="font-medium text-ink">{fileName}</span>
          </p>
        )}
      </Card>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-600/20">
          {error}
        </p>
      )}

      {done && (
        <Card className="border-emerald-200 bg-emerald-50/50 p-5">
          <p className="font-medium text-emerald-800">Import fullført ✓</p>
          <p className="mt-1 text-sm text-emerald-700">
            {done.inserted} timer ble lagret
            {done.createdTeachers > 0
              ? `, og ${done.createdTeachers} ny(e) lærer(e) ble opprettet.`
              : "."}
          </p>
        </Card>
      )}

      {/* Preview */}
      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rader totalt" value={result.rows.length} />
            <Stat label="Klare til import" value={result.validCount} tone="ok" />
            <Stat label="Med feil" value={result.errorCount} tone={result.errorCount ? "warn" : "muted"} />
            <Stat label="Nye lærere" value={result.newTeacherNames.length} tone={result.newTeacherNames.length ? "info" : "muted"} />
          </div>

          {result.newTeacherNames.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-medium text-ink">
                Disse lærerne finnes ikke ennå:
              </p>
              <p className="mt-1 text-sm text-muted">
                {result.newTeacherNames.join(", ")}
              </p>
            </Card>
          )}

          {/* Options */}
          <Card className="space-y-3 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={createMissing}
                onChange={(e) => setCreateMissing(e.target.checked)}
                className="mt-1 h-4 w-4 accent-brand-600"
              />
              <span className="text-sm">
                <span className="font-medium text-ink">Opprett nye lærere automatisk</span>
                <span className="block text-muted">
                  Lager lærere som ikke finnes fra før (du kan fylle inn telefon senere).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="mt-1 h-4 w-4 accent-brand-600"
              />
              <span className="text-sm">
                <span className="font-medium text-ink">Erstatt eksisterende timeplan</span>
                <span className="block text-muted">
                  Sletter tidligere timer for de berørte lærerne før import (trygt å kjøre på nytt).
                </span>
              </span>
            </label>
          </Card>

          <Card className="overflow-hidden">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-canvas">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Lærer</th>
                    <th className="px-3 py-2 font-medium">Dag</th>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Fag</th>
                    <th className="px-3 py-2 font-medium">Klasse</th>
                    <th className="px-3 py-2 font-medium">Rom</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <PreviewRow key={i} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                setFileName(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Avbryt
            </Button>
            <Button onClick={commit} disabled={committing || result.validCount === 0}>
              {committing
                ? "Importerer …"
                : `Importer ${result.validCount} timer`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function PreviewRow({ row }: { row: ParsedRow }) {
  return (
    <tr className={`border-b border-line/60 ${row.error ? "bg-red-50/40" : ""}`}>
      <td className="px-3 py-1.5 tabular text-muted">{row.rowNumber}</td>
      <td className="px-3 py-1.5 font-medium text-ink">{row.teacher_name || "—"}</td>
      <td className="px-3 py-1.5">{row.weekday ? WEEKDAY_SHORT[row.weekday] : row.weekdayRaw || "—"}</td>
      <td className="px-3 py-1.5 tabular">{row.period ?? "—"}</td>
      <td className="px-3 py-1.5">{row.subject ?? "—"}</td>
      <td className="px-3 py-1.5">{row.class_group ?? "—"}</td>
      <td className="px-3 py-1.5 text-muted">{row.room ?? "—"}</td>
      <td className="px-3 py-1.5">
        {row.error ? (
          <span className="text-xs font-medium text-red-700">{row.error}</span>
        ) : (
          <span className="text-xs font-medium text-emerald-700">OK</span>
        )}
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "info" | "muted";
}) {
  const toneClass = {
    ok: "text-emerald-700",
    warn: "text-amber-700",
    info: "text-brand-700",
    muted: "text-ink",
  }[tone];
  return (
    <Card className="px-4 py-3">
      <div className={`text-2xl font-semibold tabular ${toneClass}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Card>
  );
}
