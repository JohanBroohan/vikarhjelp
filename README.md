# Vikarhjelp

A small web app that helps a school principal manage teacher absences and lesson
coverage. When a teacher calls in sick, Vikarhjelp instantly shows — for every
lesson that teacher has that day — which other teachers are free to cover it,
ranked fairly by who's done the least extra work this month. If nobody is free,
it surfaces the external substitutes ("vikarer") to call. Every cover is logged
for later payroll/settlement.

- **Single user** (the principal) behind one login. No teacher accounts.
- **Interface language: Norwegian (bokmål).** Code/comments are English.
- **Desktop-first**, responsive down to phone.

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Auth) ·
Tailwind CSS v4 · deploys to Vercel.

---

## Table of contents

1. [Quick start (local)](#1-quick-start-local)
2. [The database schema](#2-the-database-schema)
3. [The coverage engine](#3-the-coverage-engine)
4. [Project structure](#4-project-structure)
5. [Deploying to Vercel](#5-deploying-to-vercel-first-time-friendly)
6. [Connecting a custom domain](#6-connecting-a-custom-domain)
7. [Tests & scripts](#7-tests--scripts)

---

## 1. Quick start (local)

### Prerequisites
- Node.js 20.9+ (you have a recent version) and npm.
- A free [Supabase](https://supabase.com) account.

### Step 1 — Create a Supabase project
1. Go to https://supabase.com/dashboard and click **New project**.
2. Give it a name (e.g. `vikarhjelp`), set a database password (save it
   somewhere), pick a region close to Norway (e.g. *Frankfurt*), and create it.
3. Wait ~2 minutes for it to provision.

### Step 2 — Get your API keys
In the Supabase dashboard: **Project Settings → API**. You need three values:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key (under "Project API keys", click reveal) →
  `SUPABASE_SERVICE_ROLE_KEY` — **secret, never commit or expose in the browser.**

### Step 3 — Create `.env.local`
Copy the template and fill in your values:
```bash
cp .env.example .env.local
```
```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

### Step 4 — Create the database tables
In the Supabase dashboard: **SQL Editor → New query**. Run **every** migration
file in `supabase/migrations/` **in numeric order** (open each, copy its
contents, paste, click *Run*):
1. `0001_initial_schema.sql`
2. `0002_rls_policies.sql`
3. `0003_absence_time_window.sql`
4. `0004_vikar_availability.sql`

(If you prefer the Supabase CLI, `supabase db push` works too — but the SQL
editor is the simplest first-time path.)

### Step 5 — Create the principal login
Email/password, one account only:
1. **Authentication → Users → Add user → Create new user.**
2. Enter the principal's email + a password. Tick **Auto Confirm User** so the
   account is usable immediately.
3. **Authentication → Sign In / Providers** (or *Settings*): turn **off**
   "Allow new users to sign up" so no one else can register.

### Step 6 — Seed demo data (optional but recommended)
Fills the database with 8 fake teachers, a weekly timetable (including two
co-taught lessons), and a few vikars so you can click around immediately:
```bash
npm install
npm run seed
```

### Step 7 — Run it
```bash
npm run dev
```
Open http://localhost:3000, log in with the account from Step 5, and you're in.

> Until `.env.local` has valid keys, every page redirects to a login screen that
> says "Supabase er ikke konfigurert" — that's expected.

---

## 2. The database schema

Five tables, all with `uuid` primary keys and a `created_at` timestamp. RLS is
on for every table with a single policy: **any authenticated request may read and
write everything** (there's only one user). The full SQL is in
`supabase/migrations/`.

| Table | Purpose | Key columns |
|---|---|---|
| **teachers** | School staff | `name`, `phone`, `email`, `is_active` |
| **vikars** | External substitutes | `name`, `phone`, `email`, `notes`, `is_active`, `unavailable_weekdays` (weekdays they can't work) |
| **lessons** | The fixed weekly timetable, one row per recurring slot | `teacher_id`, `weekday` (1–5), `period` (1..N daily time slots — defined in `PERIOD_TIMES` in `lib/constants.ts`), `subject`, `class_group`, `room`, `start_time`/`end_time` |
| **absences** | A teacher is out on a date | `teacher_id`, `date`, `reason` |
| **coverage_assignments** | One row per lesson that needed covering on a date | `date`, `lesson_id`, `absent_teacher_id`, `covering_teacher_id?`, `covering_vikar_id?`, `status`, `is_settled`, `settled_at`, `notes` |

**Key design decisions:**
- **`period` is the canonical scheduling slot.** Availability and double-booking
  are all reasoned about per `weekday` + `period`.
- **Co-teaching needs no extra table.** Two teachers co-teach a session when
  they have `lessons` rows sharing the same `weekday` + `period` + `class_group`.
  The importer and the schedule editor produce this naturally.
- **`status`** is a Postgres enum: `pending`, `covered_by_teacher`,
  `covered_by_vikar`, `covered_by_coteacher`, `uncovered`.
- **Constraints that protect data integrity:**
  - `lessons` unique on `(teacher_id, weekday, period)` — a teacher can't be in
    two places at once; also makes import/edit an idempotent upsert.
  - `coverage_assignments` unique on `(date, lesson_id)` — re-opening a day
    **updates** rows instead of duplicating them.
  - `absences` unique on `(teacher_id, date)`.
  - A check constraint ensures at most one of `covering_teacher_id` /
    `covering_vikar_id` is set.

---

## 3. The coverage engine

The core logic lives in **`lib/coverage.ts`** as pure, dependency-free functions
(no database access), so it's easy to reason about and unit-test. The server
actions in `lib/actions/coverage.ts` fetch rows from Supabase and feed them in.

When you report a teacher absent for a date, the engine:
1. Finds the absent teacher's lessons for that weekday → each becomes a
   `pending` coverage assignment.
2. **Checks co-teachers first.** For a co-taught lesson where other teachers
   remain present, it does *not* demand a cover — it surfaces "*N andre lærer(e)
   er fortsatt til stede*" and asks "*Trenger du fortsatt vikar?*", defaulting to
   **no** (status `covered_by_coteacher`, nobody logged extra hours).
3. **Computes available teachers** for each lesson's period. A teacher is
   available only if they are active, not themselves absent that day (handles
   several teachers out at once), have no lesson of their own that period, and
   aren't already covering another lesson that same period.
4. **Ranks them fairly** — ascending by how many covers they've already done this
   calendar month (shown next to each name), tie-broken alphabetically.
5. If **no** teacher is free, flags the lesson for a vikar and lists active vikars
   with tappable phone numbers.

Tested in `lib/coverage.test.ts` (run `npm test`).

---

## 4. Project structure

```
app/
  (app)/                 # authenticated area (sidebar shell)
    page.tsx             # "I dag" dashboard
    fravaer/             # report-absence + coverage flow
    laerere/             # teachers CRUD + per-teacher schedule editor
    timeplan/            # whole-school timetable (read-only)
    vikarer/             # vikars CRUD
    ekstratimer/         # extra-hours reports + settle + drilldown
    import/              # Excel/CSV timetable import
  login/                 # the single login page
  auth/signout/          # POST sign-out route
  api/
    export/ekstratimer/  # CSV export for payroll
    template/            # downloadable import template
lib/
  coverage.ts            # pure coverage engine  (+ coverage.test.ts)
  actions/               # server actions (mutations + data loading)
  queries/               # shared read queries (extra-hours)
  supabase/              # browser/server clients + proxy session helper
  reports.ts, format.ts, constants.ts, database.types.ts
components/              # Sidebar, Modal, UI primitives, badges
proxy.ts                # auth gate (Next.js 16's renamed "middleware")
supabase/migrations/    # SQL schema (source of truth)
scripts/seed.ts         # demo-data seeder
```

---

## 5. Deploying to Vercel (first-time friendly)

Vercel deploys from a Git repository. This folder is already a Git repo.

### Step 1 — Push to GitHub
1. Create a new **empty** repository on https://github.com/new (no README).
2. In this folder:
   ```bash
   git add -A
   git commit -m "Initial Vikarhjelp app"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/vikarhjelp.git
   git push -u origin main
   ```
   `.env.local` is gitignored, so your secrets are **not** pushed. Good.

### Step 2 — Import into Vercel
1. Go to https://vercel.com, sign up/in (use "Continue with GitHub").
2. **Add New… → Project**, pick your `vikarhjelp` repo, click **Import**.
3. Vercel auto-detects Next.js. Leave the build settings as-is. (The **Root
   Directory** should be the repo root — leave it default unless you pushed this
   folder inside a larger repo, in which case set it to `vikarhjelp`.)

### Step 3 — Add environment variables
Before the first deploy, expand **Environment Variables** and add the same three
from your `.env.local`:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key (secret) |

Then click **Deploy**. In ~1–2 minutes you'll get a live URL like
`https://vikarhjelp.vercel.app`.

### Step 4 — Point Supabase Auth at the live URL
In Supabase: **Authentication → URL Configuration** → set **Site URL** to your
Vercel URL (e.g. `https://vikarhjelp.vercel.app`). Save.

That's it — your migrations and data already live in Supabase, so the deployed
app uses the same database. Log in with your principal account.

> Whenever you push to `main`, Vercel redeploys automatically.

---

## 6. Connecting a custom domain

Say you own `vikarhjelp.no` (buy one from any registrar — Domeneshop, Cloudflare,
Namecheap, etc. if you don't yet).

### Step 1 — Add it in Vercel
**Project → Settings → Domains → Add.** Type your domain and submit. Vercel will
show you the exact DNS records to create. Typically:

| Type | Name / Host | Value |
|---|---|---|
| `A` | `@` (the apex/root, `vikarhjelp.no`) | `76.76.21.21` *(use the IP Vercel shows you)* |
| `CNAME` | `www` | `cname.vercel-dns.com` |

- Use the **A record** for the bare domain (`vikarhjelp.no`).
- Use the **CNAME** for the `www.` subdomain (and any other subdomain).
- Some registrars don't allow a CNAME on the apex — in that case use the A record
  Vercel provides, or delegate DNS to Vercel's nameservers if you prefer.

### Step 2 — Add the records at your registrar
Log in to wherever you bought the domain, find **DNS settings**, and add the
records exactly as Vercel listed them. Save.

### Step 3 — Wait & verify
DNS can take anywhere from a few minutes to a couple of hours to propagate.
Vercel shows a green check when it sees the records, then **auto-provisions an
HTTPS certificate** — no action needed from you.

### Step 4 — Update Supabase
Set the Supabase **Site URL** (Authentication → URL Configuration) to your custom
domain, e.g. `https://vikarhjelp.no`.

You're done — the app is live on your own domain with HTTPS.

---

## 7. Tests & scripts

```bash
npm run dev        # local dev server (http://localhost:3000)
npm run build      # production build
npm run start      # run the production build
npm test           # coverage-engine unit tests (Vitest)
npm run typecheck  # TypeScript, no emit
npm run lint       # ESLint
npm run seed       # (re)load demo data — safe to re-run
```
