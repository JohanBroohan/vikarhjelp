"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { WEEKDAY_SHORT } from "@/lib/constants";
import {
  parseTeacherGrid,
  commitTeacherGrid,
  type GridParseResult,
} from "@/lib/actions/gridImport";

const NEW = "__new__";

export function GridImportClient({
  teachers,
}: {
  teachers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<GridParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ inserted: number; created: boolean } | null>(null);

  const [assign, setAssign] = useState<string>(""); // teacherId | NEW | ""
  const [newName, setNewName] = useState("");

  // Editable per-row times (period -> {start,end}); lets the principal fix a
  // wrong time in the preview before saving. All cells in a row share a time.
  const [slotTimes, setSlotTimes] = useState<Record<number, { start: string; end: string }>>({});

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
      const res = await parseTeacherGrid(fd);
      if (!res.ok) return setError(res.error);
      const data = res.data!;
      setResult(data);
      // Seed the editable per-row times from the parsed grid (one per period).
      const st: Record<number, { start: string; end: string }> = {};
      for (const e of data.entries) {
        if (!st[e.period]) st[e.period] = { start: e.start, end: e.end };
      }
      setSlotTimes(st);
      // Pre-select the teacher: match detected name, else offer to create it,
      // else fall back to the filename (minus extension).
      const detected =
        data.teacherName ?? file.name.replace(/\.[^.]+$/, "").trim();
      const match = teachers.find(
        (t) => t.name.toLowerCase() === detected.toLowerCase(),
      );
      if (match) {
        setAssign(match.id);
      } else {
        setAssign(NEW);
        setNewName(detected);
      }
    });
  }

  function commit() {
    if (!result) return;
    setError(null);
    startCommit(async () => {
      // Apply any edited times to the entries before saving.
      const entries = result.entries.map((e) => ({
        ...e,
        start: slotTimes[e.period]?.start ?? e.start,
        end: slotTimes[e.period]?.end ?? e.end,
      }));
      const res = await commitTeacherGrid({
        teacherId: assign && assign !== NEW ? assign : undefined,
        newTeacherName: assign === NEW ? newName : undefined,
        entries,
      });
      if (!res.ok) return setError(res.error);
      setDone(res.data!);
      setResult(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  const canCommit =
    !!result && (assign && assign !== NEW ? true : assign === NEW && newName.trim().length > 0);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-ink">Last opp én lærers timeplan</p>
            <p className="text-sm text-muted">
              Eksporter lærerens ark fra Numbers til Excel (.xlsx) eller CSV, og last
              det opp her. Rutenettet leses automatisk (ukedager × tidsrader).
            </p>
          </div>
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
          <p className="font-medium text-emerald-800">Timeplan importert ✓</p>
          <p className="mt-1 text-sm text-emerald-700">
            {done.inserted} timer ble lagret
            {done.created ? " og en ny lærer ble opprettet." : "."}
          </p>
        </Card>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Aktiviteter totalt" value={result.entries.length} />
            <Stat label="Undervisningsøkter" value={result.classCount} tone="ok" />
            <Stat label="Annet (vises kun)" value={result.otherCount} />
          </div>

          {result.unmatchedTimes.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-600/15">
              Noen tidsrader samsvarer ikke med skolens faste tider:{" "}
              {result.unmatchedTimes.join(", ")}. De importeres likevel — sjekk
              tidene under «Timeplan».
            </p>
          )}

          <Card className="p-4">
            <Field label="Hvilken lærer gjelder denne timeplanen?">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={assign}
                  onChange={(e) => setAssign(e.target.value)}
                  className="sm:max-w-xs"
                >
                  <option value="">Velg lærer …</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  <option value={NEW}>+ Opprett ny lærer …</option>
                </Select>
                {assign === NEW && (
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Navn på ny lærer"
                    className="sm:max-w-xs"
                  />
                )}
              </div>
            </Field>
            <p className="mt-2 text-xs text-muted">
              Lagring erstatter denne lærerens eksisterende timeplan (trygt å kjøre på nytt).
            </p>
          </Card>

          <Card className="overflow-hidden">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-canvas">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Dag</th>
                    <th className="px-3 py-2 font-medium">Tid</th>
                    <th className="px-3 py-2 font-medium">Aktivitet</th>
                    <th className="px-3 py-2 font-medium">Klasse</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {result.entries.map((e, i) => (
                    <tr key={i} className="border-b border-line/60">
                      <td className="px-3 py-1.5">{WEEKDAY_SHORT[e.weekday]}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={slotTimes[e.period]?.start ?? e.start}
                            onChange={(ev) =>
                              setSlotTimes((s) => ({
                                ...s,
                                [e.period]: {
                                  start: ev.target.value,
                                  end: s[e.period]?.end ?? e.end,
                                },
                              }))
                            }
                            className="w-[84px] rounded border border-line bg-surface px-1.5 py-1 text-xs tabular outline-none focus:border-brand-500"
                          />
                          <span className="text-muted">–</span>
                          <input
                            type="time"
                            value={slotTimes[e.period]?.end ?? e.end}
                            onChange={(ev) =>
                              setSlotTimes((s) => ({
                                ...s,
                                [e.period]: {
                                  start: s[e.period]?.start ?? e.start,
                                  end: ev.target.value,
                                },
                              }))
                            }
                            className="w-[84px] rounded border border-line bg-surface px-1.5 py-1 text-xs tabular outline-none focus:border-brand-500"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-1.5 font-medium text-ink">{e.subject}</td>
                      <td className="px-3 py-1.5 text-muted">{e.classGroup ?? "—"}</td>
                      <td className="px-3 py-1.5">
                        {e.isClass ? (
                          <span className="text-xs font-medium text-emerald-700">Klasse</span>
                        ) : (
                          <span className="text-xs text-muted">Annet</span>
                        )}
                      </td>
                    </tr>
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
            <Button onClick={commit} disabled={committing || !canCommit}>
              {committing ? "Importerer …" : "Importer timeplan"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "ok" | "muted";
}) {
  return (
    <Card className="px-4 py-3">
      <div className={`text-2xl font-medium tabular ${tone === "ok" ? "text-emerald-700" : "text-ink"}`}>
        {value}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </Card>
  );
}
