-- Employee role ("stilling"): lærer (default), fagarbeider, assistent,
-- administrasjon. Stored as a slug; labels live in lib/constants.ts.

alter table teachers
  add column if not exists role text not null default 'laerer';

-- Refresh PostgREST's schema cache so the new column is usable immediately.
notify pgrst, 'reload schema';
