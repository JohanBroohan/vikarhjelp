-- Row-Level Security.
--
-- This app has exactly one user (the principal). There are no per-teacher
-- logins and no public data. So the rule is simply: any authenticated request
-- may read and write everything; anonymous requests get nothing.
--
-- The service_role key (used only by the seed script and trusted server code)
-- bypasses RLS entirely, so it is unaffected by these policies.

alter table teachers              enable row level security;
alter table vikars                enable row level security;
alter table lessons               enable row level security;
alter table absences              enable row level security;
alter table coverage_assignments  enable row level security;

-- Helper: create one "authenticated can do everything" policy per table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'teachers', 'vikars', 'lessons', 'absences', 'coverage_assignments'
  ]
  loop
    execute format('drop policy if exists "principal_all" on %I;', t);
    execute format(
      'create policy "principal_all" on %I
         for all
         to authenticated
         using (true)
         with check (true);', t);
  end loop;
end $$;
