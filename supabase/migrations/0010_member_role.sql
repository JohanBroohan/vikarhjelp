-- Member position ("stilling"): store the account holder's role on the
-- membership, captured during onboarding / invite acceptance.

alter table memberships add column if not exists role text;

notify pgrst, 'reload schema';
