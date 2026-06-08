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
const TIMES: Record<number, [string, string]> = {
  1: ["08:30", "09:15"],
  2: ["09:15", "10:00"],
  3: ["10:15", "11:00"],
  4: ["11:00", "11:45"],
  5: ["12:15", "13:00"],
  6: ["13:00", "13:45"],
  7: ["13:55", "14:40"],
  8: ["14:40", "15:25"],
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
  { name: "Ingrid Larsen", phone: "94020001", email: "ingrid.larsen@vikar.no", notes: "Foretrekker yngre klasser (8. trinn)", is_active: true },
  { name: "Jonas Moen",    phone: "94020002", email: "jonas.moen@vikar.no",    notes: "Kun mandag–onsdag", is_active: true },
  { name: "Kari Nilsen",   phone: "94020003", email: "kari.nilsen@vikar.no",   notes: "Erfaren, alle trinn. Realfag.", is_active: true },
  { name: "Lars Olsen",    phone: "94020004", email: null,                     notes: "Pensjonert lærer. Spør gjerne.", is_active: false },
];

// --- Timetable --------------------------------------------------------------
// [weekday(1-5), period(1-8), subject, class_group, room]
// Co-teaching = two teachers with the same weekday+period+class_group.
type L = [number, number, string, string, string];

const SCHEDULE: Record<string, L[]> = {
  anna: [ // Matematikk / Naturfag
    [1, 1, "Matematikk", "8A", "R12"],
    [1, 2, "Matematikk", "8B", "R12"],
    [2, 3, "Naturfag",   "9A", "Nat1"], // co-taught with David
    [3, 1, "Matematikk", "8A", "R12"],
    [4, 2, "Naturfag",   "8A", "Nat1"],
    [5, 1, "Matematikk", "8B", "R12"],
  ],
  bjorn: [ // Norsk / Samfunnsfag
    [1, 2, "Norsk",       "8A", "R14"], // co-taught with Eva
    [1, 3, "Samfunnsfag", "9A", "R14"],
    [2, 1, "Norsk",       "9B", "R14"],
    [3, 4, "Samfunnsfag", "10A", "R14"],
    [4, 1, "Norsk",       "8B", "R14"],
    [5, 3, "Norsk",       "9A", "R14"],
  ],
  cecilie: [ // Engelsk
    [1, 1, "Engelsk", "9A", "R21"],
    [1, 4, "Engelsk", "8A", "R21"],
    [2, 2, "Engelsk", "9B", "R21"],
    [3, 3, "Engelsk", "10A", "R21"],
    [4, 4, "Engelsk", "8B", "R21"],
    [5, 2, "Engelsk", "9A", "R21"],
  ],
  david: [ // Kroppsøving / Naturfag
    [1, 5, "Kroppsøving", "8A", "Gymsal"],
    [2, 3, "Naturfag",    "9A", "Nat1"], // co-taught with Anna
    [2, 5, "Kroppsøving", "9A", "Gymsal"],
    [3, 2, "Kroppsøving", "8B", "Gymsal"],
    [4, 3, "Naturfag",    "10A", "Nat1"],
    [5, 4, "Kroppsøving", "9B", "Gymsal"],
  ],
  eva: [ // Norsk / KRLE
    [1, 2, "Norsk", "8A", "R14"], // co-taught with Bjørn
    [1, 3, "KRLE",  "8B", "R18"],
    [2, 4, "Norsk", "10A", "R18"],
    [3, 1, "KRLE",  "9A", "R18"],
    [4, 5, "Norsk", "8A", "R18"],
    [5, 1, "KRLE",  "8A", "R18"],
  ],
  frode: [ // Matematikk
    [1, 4, "Matematikk", "9A", "R13"],
    [2, 1, "Matematikk", "10A", "R13"],
    [2, 2, "Matematikk", "9B", "R13"],
    [3, 3, "Matematikk", "9A", "R13"],
    [4, 1, "Matematikk", "10A", "R13"],
    [5, 5, "Matematikk", "8A", "R13"],
  ],
  guro: [ // Kunst og håndverk / Musikk
    [1, 6, "Kunst og håndverk", "8A", "Kunst"],
    [2, 6, "Musikk",            "9A", "Musikk"],
    [3, 5, "Kunst og håndverk", "9B", "Kunst"],
    [3, 6, "Musikk",            "8B", "Musikk"],
    [4, 6, "Kunst og håndverk", "10A", "Kunst"],
    [5, 6, "Musikk",            "8A", "Musikk"],
  ],
  henrik: [ // Samfunnsfag / Engelsk
    [1, 1, "Samfunnsfag", "10A", "R16"],
    [2, 2, "Engelsk",     "8A", "R16"],
    [2, 4, "Samfunnsfag", "9B", "R16"],
    [3, 2, "Samfunnsfag", "8A", "R16"],
    [4, 4, "Engelsk",     "9A", "R16"],
    [5, 4, "Samfunnsfag", "10A", "R16"],
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
      `  Co-teaching: Anna+David (tir. 3. time, 9A Naturfag), ` +
      `Bjørn+Eva (man. 2. time, 8A Norsk).\n`,
  );
}

main().catch((err) => {
  console.error("\n✗ Seed feilet:", err.message ?? err);
  process.exit(1);
});
