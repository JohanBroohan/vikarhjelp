-- Vikarhjelp — initial schema
-- Postgres / Supabase. All tables use UUID primary keys and a created_at
-- timestamp. Run this in the Supabase SQL editor (or via the Supabase CLI).

-- gen_random_uuid() lives in pgcrypto; available by default on Supabase.
create extension if not exists pgcrypto;

-- Coverage status lifecycle for a single lesson on a single date.
do $$ begin
  create type coverage_status as enum (
    'pending',
    'covered_by_teacher',
    'covered_by_vikar',
    'covered_by_coteacher',
    'uncovered'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- teachers — the school's own staff
-- ---------------------------------------------------------------------------
create table if not exists teachers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- vikars — external substitutes to call when no teacher is free
-- ---------------------------------------------------------------------------
create table if not exists vikars (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- lessons — the fixed, weekly-repeating timetable (one row per recurring slot)
-- Co-teaching = multiple rows sharing weekday + period + class_group.
-- ---------------------------------------------------------------------------
create table if not exists lessons (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references teachers(id) on delete cascade,
  weekday     integer not null check (weekday between 1 and 5), -- Mon=1..Fri=5
  period      integer not null check (period between 1 and 12), -- canonical slot
  start_time  text,   -- display only, e.g. "08:30"
  end_time    text,   -- display only, e.g. "09:15"
  subject     text,
  class_group text,
  room        text,
  created_at  timestamptz not null default now(),
  -- A teacher can only be in one place per weekday+period.
  unique (teacher_id, weekday, period)
);

create index if not exists lessons_teacher_idx on lessons (teacher_id);
create index if not exists lessons_slot_idx on lessons (weekday, period);
create index if not exists lessons_coteach_idx on lessons (weekday, period, class_group);

-- ---------------------------------------------------------------------------
-- absences — a teacher reported sick on a specific date
-- ---------------------------------------------------------------------------
create table if not exists absences (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references teachers(id) on delete cascade,
  date        date not null,
  reason      text,
  created_at  timestamptz not null default now(),
  -- One absence row per teacher per date (re-reporting updates, never duplicates).
  unique (teacher_id, date)
);

create index if not exists absences_date_idx on absences (date);

-- ---------------------------------------------------------------------------
-- coverage_assignments — one row per lesson that needed covering on a date
-- ---------------------------------------------------------------------------
create table if not exists coverage_assignments (
  id                  uuid primary key default gen_random_uuid(),
  date                date not null,
  lesson_id           uuid not null references lessons(id) on delete cascade,
  absent_teacher_id   uuid not null references teachers(id) on delete cascade,
  covering_teacher_id uuid references teachers(id) on delete set null,
  covering_vikar_id   uuid references vikars(id)   on delete set null,
  status              coverage_status not null default 'pending',
  is_settled          boolean not null default false,
  settled_at          timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  -- At most one covering person is set at a time.
  constraint one_coverer check (
    not (covering_teacher_id is not null and covering_vikar_id is not null)
  ),
  -- Re-opening a date updates existing rows instead of duplicating them.
  unique (date, lesson_id)
);

create index if not exists coverage_date_idx on coverage_assignments (date);
create index if not exists coverage_covering_teacher_idx
  on coverage_assignments (covering_teacher_id);
create index if not exists coverage_absent_teacher_idx
  on coverage_assignments (absent_teacher_id);
