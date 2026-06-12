/**
 * Non-destructive top-up: adds teachers until the school has TARGET of them.
 * Unlike `npm run seed`, this NEVER deletes anything — it only inserts new
 * names that don't already exist.
 *
 * Run with:  npm run add-teachers
 * (reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local)
 */

import { createClient } from "@supabase/supabase-js";

const TARGET = 20;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\n✗ Mangler miljøvariabler. Sett NEXT_PUBLIC_SUPABASE_URL og " +
      "SUPABASE_SERVICE_ROLE_KEY i .env.local.\n",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// A pool of extra Norwegian teachers to draw from. Phone numbers are in a
// distinct range from the seed so they don't clash.
const POOL = [
  { name: "Ingrid Knudsen", phone: "90011001", email: "ingrid.knudsen@skolen.no" },
  { name: "Jonas Lund", phone: "90011002", email: "jonas.lund@skolen.no" },
  { name: "Kristin Moe", phone: "90011003", email: "kristin.moe@skolen.no" },
  { name: "Lars Nilsen", phone: "90011004", email: "lars.nilsen@skolen.no" },
  { name: "Maria Olsen", phone: "90011005", email: "maria.olsen@skolen.no" },
  { name: "Nils Pedersen", phone: "90011006", email: "nils.pedersen@skolen.no" },
  { name: "Oda Rasmussen", phone: "90011007", email: "oda.rasmussen@skolen.no" },
  { name: "Petter Sand", phone: "90011008", email: "petter.sand@skolen.no" },
  { name: "Rita Tangen", phone: "90011009", email: "rita.tangen@skolen.no" },
  { name: "Sander Ulriksen", phone: "90011010", email: "sander.ulriksen@skolen.no" },
  { name: "Tone Vik", phone: "90011011", email: "tone.vik@skolen.no" },
  { name: "Vegard Aas", phone: "90011012", email: "vegard.aas@skolen.no" },
  { name: "Camilla Strand", phone: "90011013", email: "camilla.strand@skolen.no" },
  { name: "Erik Solberg", phone: "90011014", email: "erik.solberg@skolen.no" },
  { name: "Hanne Bakke", phone: "90011015", email: "hanne.bakke@skolen.no" },
];

async function main() {
  const { data: existing, error } = await db.from("teachers").select("name");
  if (error) throw error;

  const have = existing?.length ?? 0;
  const existingLower = new Set(
    (existing ?? []).map((t) => t.name.trim().toLowerCase()),
  );

  if (have >= TARGET) {
    console.log(`\n✓ Du har allerede ${have} lærere (mål: ${TARGET}). Ingenting å gjøre.\n`);
    return;
  }

  const need = TARGET - have;
  const toAdd = POOL.filter((t) => !existingLower.has(t.name.toLowerCase())).slice(0, need);

  if (toAdd.length === 0) {
    console.log(
      `\n⚠ Fant ingen nye navn å legge til (navnene i lista finnes allerede). ` +
        `Du har ${have} lærere. Legg til flere navn i POOL i scripts/add-teachers.ts.\n`,
    );
    return;
  }

  const { error: insErr } = await db.from("teachers").insert(toAdd);
  if (insErr) throw insErr;

  console.log(
    `\n✓ La til ${toAdd.length} lærere: ${toAdd.map((t) => t.name).join(", ")}.\n` +
      `  Totalt nå: ${have + toAdd.length} lærere.\n`,
  );
}

main().catch((err) => {
  console.error("\n✗ Feilet:", err.message ?? err);
  process.exit(1);
});
