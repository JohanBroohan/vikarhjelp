-- Partial-day absences: an optional time window on an absence.
-- Both NULL  => the teacher is out the whole day (the default).
-- Set        => the teacher is only out between start_time and end_time, and
--               only lessons overlapping that window need covering.
-- Stored as text "HH:MM" to match lessons.start_time / lessons.end_time.

alter table absences add column if not exists start_time text;
alter table absences add column if not exists end_time text;
