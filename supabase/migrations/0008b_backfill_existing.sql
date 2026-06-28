-- ONE-TIME backfill — run AFTER 0008_multi_tenant.sql.
-- Attaches all existing data to a new school and makes you its first member.
--
-- Replace BOTH occurrences of 'you@example.com' with the email you log in with,
-- then run this once in the Supabase SQL editor.

do $$
declare
  uid uuid;
  sid uuid;
begin
  select id into uid from auth.users where email = 'you@example.com' limit 1;
  if uid is null then
    raise exception 'No auth user with that email — sign in once first, then run this.';
  end if;

  insert into schools (name) values ('Min skole') returning id into sid;
  insert into memberships (user_id, school_id, email)
    values (uid, sid, 'you@example.com')
    on conflict (user_id) do update set school_id = excluded.school_id;

  update teachers              set school_id = sid where school_id is null;
  update vikars                set school_id = sid where school_id is null;
  update lessons               set school_id = sid where school_id is null;
  update absences              set school_id = sid where school_id is null;
  update coverage_assignments  set school_id = sid where school_id is null;
end $$;
