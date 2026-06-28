-- Multi-tenancy: many schools, each with several user accounts. Data is
-- isolated per school via row-level security keyed on the caller's membership.
--
-- After running this, run the one-time backfill in
-- supabase/migrations/0008b_backfill_existing.sql (substitute your email) so
-- your existing data is attached to a school and you become its first member.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tenancy tables
-- ---------------------------------------------------------------------------
create table if not exists schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  school_id   uuid not null references schools(id) on delete cascade,
  email       text,
  created_at  timestamptz not null default now(),
  unique (user_id) -- one school per user
);
create index if not exists memberships_school_idx on memberships (school_id);

create table if not exists invitations (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now()
);
-- Unique on an expression must be an index, not a table constraint.
create unique index if not exists invitations_school_email_uniq
  on invitations (school_id, lower(email));
create index if not exists invitations_email_idx on invitations (lower(email));

-- ---------------------------------------------------------------------------
-- The caller's school. SECURITY DEFINER so reading `memberships` here does NOT
-- re-trigger membership RLS (which would recurse).
-- ---------------------------------------------------------------------------
create or replace function my_school_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select school_id from memberships where user_id = auth.uid() limit 1
$$;

-- Auto-stamp school_id on insert so existing write paths need no changes.
create or replace function set_school_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.school_id is null then
    new.school_id := my_school_id();
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- Add school_id to every data table (+ index + auto-stamp trigger).
-- Nullable: rows stay invisible until backfilled; new rows get it via trigger.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'teachers', 'vikars', 'lessons', 'absences', 'coverage_assignments'
  ]
  loop
    execute format(
      'alter table %I add column if not exists school_id uuid references schools(id) on delete cascade;',
      t);
    execute format('create index if not exists %I on %I (school_id);', t || '_school_idx', t);
    execute format('drop trigger if exists stamp_school_id on %I;', t);
    execute format(
      'create trigger stamp_school_id before insert on %I
         for each row execute function set_school_id();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table schools     enable row level security;
alter table memberships enable row level security;
alter table invitations enable row level security;

-- Data tables: replace the old "any authenticated" policy with school scoping.
do $$
declare t text;
begin
  foreach t in array array[
    'teachers', 'vikars', 'lessons', 'absences', 'coverage_assignments'
  ]
  loop
    execute format('drop policy if exists "principal_all" on %I;', t);
    execute format('drop policy if exists "school_scope" on %I;', t);
    execute format(
      'create policy "school_scope" on %I
         for all to authenticated
         using (school_id = my_school_id())
         with check (school_id = my_school_id());', t);
  end loop;
end $$;

-- Schools: a member can read their own school. Creation happens via a trusted
-- server action (service role), so no insert policy here.
drop policy if exists "school_read" on schools;
create policy "school_read" on schools
  for select to authenticated
  using (id = my_school_id());

-- Memberships: a member can see co-members and remove them. Inserts happen via
-- the service role (onboarding / accept-invite), so no insert policy here.
drop policy if exists "membership_read" on memberships;
create policy "membership_read" on memberships
  for select to authenticated
  using (school_id = my_school_id());

drop policy if exists "membership_delete" on memberships;
create policy "membership_delete" on memberships
  for delete to authenticated
  using (school_id = my_school_id());

-- Invitations: a member fully manages their own school's invitations.
drop policy if exists "invitation_all" on invitations;
create policy "invitation_all" on invitations
  for all to authenticated
  using (school_id = my_school_id())
  with check (school_id = my_school_id());

notify pgrst, 'reload schema';
