-- Custom users table (app-managed auth — NOT Supabase Auth).
-- Apply: supabase db push  OR paste into the SQL editor.
--
-- RLS is ENABLED with NO policies: the anon/publishable key is fully blocked,
-- while the server (SUPABASE_SECRET_KEY / service_role) bypasses RLS. All access
-- goes through server-side API routes. Never expose the secret key to the browser.

create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  name          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (lower(email));

alter table public.users enable row level security;
