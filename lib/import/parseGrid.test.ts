import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseGridTable, parseGridBuffer, type GridParseResult } from "./parseGrid";

/* ---- direct table cases (no fixture files needed) ------------------------ */

function ok(res: ReturnType<typeof parseGridTable>): GridParseResult {
  expect(res.ok).toBe(true);
  if (!res.ok) throw new Error(res.error);
  return res.data!;
}

/** Every (weekday, period) pair must be unique — the DB key the importer writes. */
function assertUniqueSlots(data: GridParseResult) {
  const seen = new Set<string>();
  for (const e of data.entries) {
    const k = `${e.weekday}-${e.period}`;
    expect(seen.has(k), `duplicate slot ${k}`).toBe(false);
    seen.add(k);
  }
}

describe("parseGridTable — layout detection", () => {
  it("reads a shared «Tid» column with canonical bell times", () => {
    const data = ok(
      parseGridTable([
        ["Timeplan for Ola Hansen", "", "", "", "", ""],
        ["Tid", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"],
        ["07:30-08:00", "Kontor", "Kontor", "Tilsyn", "Kontor", "Kontor"],
        ["08:30-11:30", "Matematikk 8. trinn", "Norsk 8. trinn", "Møte", "Matematikk 8. trinn", "Naturfag 8. trinn"],
      ]),
    );
    expect(data.teacherName).toBe("Ola Hansen");
    // 07:30 and 08:30 are canonical → periods 1 and 3.
    const mon = data.entries.filter((e) => e.weekday === 1).sort((a, b) => a.period - b.period);
    expect(mon.map((e) => e.period)).toEqual([1, 3]);
    assertUniqueSlots(data);
  });

  it("reads per-cell embedded times with weekdays in column 0", () => {
    const data = ok(
      parseGridTable([
        ["Kari Nordmann", "", "", "", ""],
        ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"],
        ["08:15-09:00 Matematikk 3. trinn", "08:15-09:00 Norsk 3. trinn", "", "08:15-09:00 Engelsk 3. trinn", "08:15-09:00 Naturfag 3. trinn"],
        ["09:10-10:00 Norsk 3. trinn", "", "09:10-10:00 Møte", "09:10-10:00 Kroppsøving 3. trinn", ""],
      ]),
    );
    expect(data.teacherName).toBe("Kari Nordmann");
    // Per-cell mode gives every entry a globally-unique period.
    const periods = data.entries.map((e) => e.period);
    expect(new Set(periods).size).toBe(periods.length);
    assertUniqueSlots(data);
  });

  it("normalizes mixed time formats and separators (0830, 8.30, «til», en-dash)", () => {
    const data = ok(
      parseGridTable([
        ["Per Olsen", "", "", "", ""],
        ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"],
        ["0815-0900 Kontor", "8.30–9.15 Matematikk 6. trinn", "0930 til 1015 Norsk 6. trinn", "", ""],
      ]),
    );
    const starts = data.entries.map((e) => `${e.start}-${e.end}`);
    expect(starts).toContain("08:15-09:00");
    expect(starts).toContain("08:30-09:15");
    expect(starts).toContain("09:30-10:15");
  });

  it("maps English and abbreviated weekday names", () => {
    const en = ok(
      parseGridTable([
        ["Tid", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        ["08:00-08:45", "Matematikk 10. trinn", "Norsk 10. trinn", "Kontor", "Engelsk 10. trinn", "Naturfag 10. trinn"],
      ]),
    );
    expect(new Set(en.entries.map((e) => e.weekday))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it("splits subject and class group, and infers activity type", () => {
    const data = ok(
      parseGridTable([
        ["Tid", "Mandag", "Tirsdag", "Onsdag"],
        ["08:00-08:45", "Matematikk 1.-2. trinn", "Kontor", "Tilsyn"],
      ]),
    );
    const mat = data.entries.find((e) => e.subject === "Matematikk")!;
    expect(mat.classGroup).toBe("1.-2. trinn");
    expect(mat.activityType).toBe("undervisning");
    expect(mat.isClass).toBe(true);
    expect(data.entries.find((e) => e.raw === "Kontor")!.activityType).toBe("kontor");
    expect(data.entries.find((e) => e.raw === "Tilsyn")!.activityType).toBe("tilsyn");
  });

  it("treats a placeholder «Timeplan for X» as no name", () => {
    const data = ok(
      parseGridTable([
        ["Timeplan for X", "", "", ""],
        ["Tid", "Mandag", "Tirsdag", "Onsdag"],
        ["08:00-08:45", "Matematikk 5. trinn", "Norsk 5. trinn", "Kontor"],
      ]),
    );
    expect(data.teacherName).toBeNull();
  });

  it("errors clearly when there is no weekday row", () => {
    const res = parseGridTable([
      ["Fag", "Rom", "Lærer"],
      ["Matematikk", "12", "OH"],
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/ukedag/i);
  });

  it("errors clearly when there are weekdays but no times", () => {
    const res = parseGridTable([
      ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"],
      ["Matematikk", "Norsk", "Engelsk", "Naturfag", "Kontor"],
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/klokkeslett/i);
  });
});

/* ---- the 10 generated fixture files (real .xlsx bytes) ------------------- */

const FIXTURES_DIR = join(process.cwd(), "test-timeplaner");
const hasFixtures = existsSync(FIXTURES_DIR);
const describeFixtures = hasFixtures ? describe : describe.skip;

describeFixtures("sample timetable files parse end-to-end", () => {
  const files = hasFixtures
    ? readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".xlsx")).sort()
    : [];

  it("has the 10 sample files", () => {
    expect(files.length).toBe(10);
  });

  for (const file of files) {
    it(`parses ${file} with unique slots and at least one class`, () => {
      const buf = readFileSync(join(FIXTURES_DIR, file));
      const data = ok(parseGridBuffer(buf));
      expect(data.entries.length).toBeGreaterThan(0);
      assertUniqueSlots(data);
      expect(data.classCount).toBeGreaterThan(0);
      // Every entry has a normalized HH:MM start/end and a weekday 1..5.
      for (const e of data.entries) {
        expect(e.start).toMatch(/^\d{2}:\d{2}$/);
        expect(e.end).toMatch(/^\d{2}:\d{2}$/);
        expect(e.weekday).toBeGreaterThanOrEqual(1);
        expect(e.weekday).toBeLessThanOrEqual(5);
      }
    });
  }

  it("detects the teacher name in the messy real-world sheet", () => {
    const buf = readFileSync(join(FIXTURES_DIR, "10_rotete_virkelighetsnaer.xlsx"));
    const data = ok(parseGridBuffer(buf));
    expect(data.teacherName).toBe("Johan Renli");
  });
});
