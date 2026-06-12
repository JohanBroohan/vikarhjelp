-- Absence type ("fraværstype"): Egenmelding (default), Sykemelding, etc.
-- Stored as a slug; the labels live in lib/constants.ts (ABSENCE_TYPES).

alter table absences
  add column if not exists absence_type text not null default 'egenmelding';

-- Refresh PostgREST's schema cache so the new column is usable immediately.
notify pgrst, 'reload schema';
