-- Enable Supabase Realtime on the tables the Oversikt board watches, so changes
-- (new absences, covers, timetable edits) push to the TV screen instantly.
--
-- Realtime delivers changes through the `supabase_realtime` publication. This
-- adds our tables to it, only if they aren't already members (safe to re-run).

do $$
declare
  t text;
begin
  foreach t in array array[
    'teachers', 'vikars', 'lessons', 'absences', 'coverage_assignments'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
