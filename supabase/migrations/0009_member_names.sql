-- Member names: store first/last name on the membership (per user, readable by
-- co-members so the Medlemmer list can show names).

alter table memberships add column if not exists first_name text;
alter table memberships add column if not exists last_name text;

notify pgrst, 'reload schema';
