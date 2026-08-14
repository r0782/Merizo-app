-- Merizo: invite links for QR-code / shareable trip invites.
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
--
-- Supersedes the old static trips.invite_token column: invites now live in
-- their own table so they can expire, be revoked, and be regenerated without
-- mutating the trip row. trips.invite_token is left in place (unused) rather
-- than dropped, so nothing existing breaks.

create table if not exists trip_invites (
  id          text primary key,
  trip_id     text not null,
  token       text not null unique,
  created_by  text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  status      text not null default 'active' check (status in ('active', 'revoked')),
  usage_count integer not null default 0,
  max_uses    integer
);

create index if not exists idx_trip_invites_token   on trip_invites (token);
create index if not exists idx_trip_invites_trip_id on trip_invites (trip_id);

-- This table is only ever read/written by the backend using the service-role
-- key, never directly by the Expo client (which uses the anon key). Lock it
-- down entirely for the anon/authenticated roles as defense in depth.
alter table trip_invites enable row level security;

create policy "trip_invites_service_role_only" on trip_invites
  for all
  using (false)
  with check (false);
