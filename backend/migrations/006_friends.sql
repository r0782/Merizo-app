-- Friends list — added by scanning another user's profile QR (their email)
-- or entering an email manually. Reused as quick-add members when creating
-- or editing a split (see /friends in server.py, app/friends.tsx).

create table if not exists friends (
  id             text primary key,
  owner_id       text not null,
  friend_email   text not null,
  friend_name    text,
  friend_user_id text,
  created_at     timestamptz not null default now(),
  unique (owner_id, friend_email)
);

create index if not exists idx_friends_owner on friends (owner_id);

alter table friends enable row level security;

create policy "friends_service_role_only" on friends
  for all using (false) with check (false);
