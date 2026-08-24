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


alter table trip_invites enable row level security;

create policy "trip_invites_service_role_only" on trip_invites
  for all
  using (false)
  with check (false);
