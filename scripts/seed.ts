/**
 * Seed script — fills a fresh Supabase database with fake-but-realistic data so
 * the principal can click around immediately.
 *
 * Run with:  npm run seed
 * (reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local)
 *
 * Idempotent: it deletes all existing rows in these tables first, then inserts
 * a clean set. The service-role key bypasses RLS.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\n✗ Mangler miljøvariabler. Sett NEXT_PUBLIC_SUPABASE_URL og " +
      "SUPABASE_SERVICE_ROLE_KEY i .env.local før du kjører seed.\n",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

// --- Period clock (display only) -------------------------------------------
// Montessori school: two long work cycles per day.
const TIMES: Record<number, [string, string]> = {
  1: ["08:30", "11:30"],
  2: ["12:30", "15:00"],
};

// --- Staff ------------------------------------------------------------------
const TEACHERS = [
  { key: "anna",    name: "Anna Berg",        phone: "90010001", email: "anna.berg@skolen.no" },
  { key: "bjorn",   name: "Bjørn Dahl",       phone: "90010002", email: "bjorn.dahl@skolen.no" },
  { key: "cecilie", name: "Cecilie Eide",     phone: "90010003", email: "cecilie.eide@skolen.no" },
  { key: "david",   name: "David Foss",       phone: "90010004", email: "david.foss@skolen.no" },
  { key: "eva",     name: "Eva Gundersen",    phone: "90010005", email: "eva.gundersen@skolen.no" },
  { key: "frode",   name: "Frode Haugen",     phone: "90010006", email: "frode.haugen@skolen.no" },
  { key: "guro",    name: "Guro Iversen",     phone: "90010007", email: "guro.iversen@skolen.no" },
  { key: "henrik",  name: "Henrik Johansen",  phone: "90010008", email: "henrik.johansen@skolen.no" },
];

const VIKARS = [
  // unavailable_weekdays: Mon=1 .. Fri=5 — days the vikar cannot work.
  { name: "Ingrid Larsen", phone: "94020001", email: "ingrid.larsen@vikar.no", notes: "Foretrekker yngre klasser (8. trinn)", is_active: true,  unavailable_weekdays: [2] },        // studerer på tirsdager
  { name: "Jonas Moen",    phone: "94020002", email: "jonas.moen@vikar.no",    notes: "Kun mandag–onsdag", is_active: true,  unavailable_weekdays: [4, 5] }, // torsdag/fredag
  { name: "Kari Nilsen",   phone: "94020003", email: "kari.nilsen@vikar.no",   notes: "Erfaren, alle trinn. Realfag.", is_active: true,  unavailable_weekdays: [] },
  { name: "Lars Olsen",    phone: "94020004", email: null,                     notes: "Pensjonert lærer. Spør gjerne.", is_active: false, unavailable_weekdays: [] },
];

// --- Timetable --------------------------------------------------------------
// [weekday(1-5), period(1-2), subject, class_group, room]
// Montessori school: two long work cycles ("timer") per day.
// Co-teaching = two teachers with the same weekday+period+class_group.
type L = [number, number, string, string, string];

const SCHEDULE: Record<string, L[]> = {
  anna: [ // Matematikk / Naturfag
    [1, 1, "Matematikk", "8A", "R12"],
    [2, 1, "Naturfag",   "9A", "Nat1"], // co-taught with David
    [3, 2, "Matematikk", "8A", "R12"],
    [4, 1, "Naturfag",   "8A", "Nat1"],
    [5, 2, "Matematikk", "8B", "R12"],
  ],
  bjorn: [ // Norsk / Samfunnsfag
    [1, 1, "Norsk",       "8A", "R14"], // co-taught with Eva
    [2, 2, "Samfunnsfag", "9A", "R14"],
    [3, 1, "Norsk",       "9B", "R14"],
    [4, 2, "Samfunnsfag", "10A", "R14"],
    [5, 1, "Norsk",       "9A", "R14"],
  ],
  cecilie: [ // Engelsk
    [1, 2, "Engelsk", "9A", "R21"],
    [2, 1, "Engelsk", "9B", "R21"],
    [3, 2, "Engelsk", "10A", "R21"],
    [4, 1, "Engelsk", "8B", "R21"],
    [5, 2, "Engelsk", "9A", "R21"],
  ],
  david: [ // Kroppsøving / Naturfag
    [1, 2, "Kroppsøving", "8A", "Gymsal"],
    [2, 1, "Naturfag",    "9A", "Nat1"], // co-taught with Anna
    [3, 1, "Kroppsøving", "8B", "Gymsal"],
    [4, 2, "Naturfag",    "10A", "Nat1"],
    [5, 1, "Kroppsøving", "9B", "Gymsal"],
  ],
  eva: [ // Norsk / KRLE
    [1, 1, "Norsk", "8A", "R14"], // co-taught with Bjørn
    [2, 2, "Norsk", "10A", "R18"],
    [3, 1, "KRLE",  "9A", "R18"],
    [4, 2, "Norsk", "8A", "R18"],
    [5, 1, "KRLE",  "8A", "R18"],
  ],
  frode: [ // Matematikk
    [1, 2, "Matematikk", "9A", "R13"],
    [2, 1, "Matematikk", "10A", "R13"],
    [3, 2, "Matematikk", "9A", "R13"],
    [4, 1, "Matematikk", "10A", "R13"],
    [5, 2, "Matematikk", "8A", "R13"],
  ],
  guro: [ // Kunst og håndverk / Musikk
    [1, 2, "Kunst og håndverk", "8A", "Kunst"],
    [2, 2, "Musikk",            "9A", "Musikk"],
    [3, 1, "Kunst og håndverk", "9B", "Kunst"],
    [4, 2, "Musikk",            "8B", "Musikk"],
    [5, 1, "Kunst og håndverk", "10A", "Kunst"],
  ],
  henrik: [ // Samfunnsfag / Engelsk
    [1, 1, "Samfunnsfag", "10A", "R16"],
    [2, 2, "Engelsk",     "8A", "R16"],
    [3, 1, "Samfunnsfag", "8A", "R16"],
    [4, 2, "Engelsk",     "9A", "R16"],
    [5, 1, "Samfunnsfag", "10A", "R16"],
  ],
};

async function wipe() {
  // Delete in FK-safe order. Filter matches all rows.
  const tables = ["coverage_assignments", "absences", "lessons", "vikars", "teachers"];
  for (const t of tables) {
    const { error } = await db.from(t).delete().not("id", "is", null);
    if (error) throw new Error(`Kunne ikke tømme ${t}: ${error.message}`);
  }
}

async function main() {
  console.log("→ Tømmer eksisterende data …");
  await wipe();

  console.log("→ Legger inn lærere …");
  const { data: teacherRows, error: tErr } = await db
    .from("teachers")
    .insert(TEACHERS.map((t) => ({ name: t.name, phone: t.phone, email: t.email })))
    .select("id, name");
  if (tErr) throw tErr;

  const idByKey = new Map<string, string>();
  for (const t of TEACHERS) {
    const row = teacherRows!.find((r) => r.name === t.name);
    if (!row) throw new Error(`Fant ikke lærer ${t.name} etter innsetting`);
    idByKey.set(t.key, row.id);
  }

  console.log("→ Legger inn vikarer …");
  const { error: vErr } = await db.from("vikars").insert(VIKARS);
  if (vErr) throw vErr;

  console.log("→ Bygger timeplan …");
  const lessonRows = Object.entries(SCHEDULE).flatMap(([key, lessons]) =>
    lessons.map(([weekday, period, subject, class_group, room]) => ({
      teacher_id: idByKey.get(key)!,
      weekday,
      period,
      subject,
      class_group,
      room,
      start_time: TIMES[period]?.[0] ?? null,
      end_time: TIMES[period]?.[1] ?? null,
    })),
  );
  const { error: lErr } = await db.from("lessons").insert(lessonRows);
  if (lErr) throw lErr;

  console.log(
    `\n✓ Ferdig: ${TEACHERS.length} lærere, ${VIKARS.length} vikarer, ` +
      `${lessonRows.length} timer.\n` +
      `  Co-teaching: Anna+David (tir. 1. time, 9A Naturfag), ` +
      `Bjørn+Eva (man. 1. time, 8A Norsk).\n`,
  );
}

main().catch((err) => {
  console.error("\n✗ Seed feilet:", err.message ?? err);
  process.exit(1);
});
