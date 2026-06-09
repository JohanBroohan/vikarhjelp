-- Per-vikar weekly availability.
-- A vikar may be unavailable on certain weekdays (e.g. studying on Tuesdays).
-- `unavailable_weekdays` holds the weekday numbers (Mon=1 .. Fri=5) the vikar
-- CANNOT work. Empty array (the default) = available every weekday.

alter table vikars
  add column if not exists unavailable_weekdays integer[] not null default '{}';

-- Refresh PostgREST's schema cache so the new column is usable immediately.
notify pgrst, 'reload schema';
