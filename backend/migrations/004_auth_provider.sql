-- Tracks how a user authenticates (see /auth/social-login, /auth/register in
-- server.py) so email/password accounts and Google/OTP accounts are both
-- explicitly recorded rather than relying on email_verified's default alone.
--
-- Default is 'password' so every existing row (email/password signups) keeps
-- its correct provider. /auth/social-login sets this to 'google' or 'otp'
-- explicitly whenever a Supabase-authenticated user is created or signs in.

alter table users
  add column if not exists auth_provider text not null default 'password';
