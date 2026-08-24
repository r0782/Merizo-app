-- Fixes Supabase lint "RLS Disabled in Public" for settlements, reminders,
-- trips, users. All access to these tables goes through the FastAPI backend
-- using the service_role key, which bypasses RLS regardless — so a deny-all
-- policy only closes off direct anon-key access via PostgREST, matching the
-- pattern already used for trip_invites (see 001_trip_invites.sql).

alter table settlements enable row level security;
create policy "settlements_service_role_only" on settlements
  for all using (false) with check (false);

alter table reminders enable row level security;
create policy "reminders_service_role_only" on reminders
  for all using (false) with check (false);

alter table trips enable row level security;
create policy "trips_service_role_only" on trips
  for all using (false) with check (false);

alter table users enable row level security;
create policy "users_service_role_only" on users
  for all using (false) with check (false);
