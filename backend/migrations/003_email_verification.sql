-- Adds email verification tracking used by the register/login OTP flow
-- (see /auth/register, /auth/verify-register-otp in server.py).
--
-- Default is `true` so every existing user (including Google/OTP sign-ins
-- and the demo account) stays able to log in without re-verifying. New
-- accounts created via /auth/register are explicitly inserted with `false`
-- until they confirm the emailed code.

alter table users
  add column if not exists email_verified boolean not null default true;
