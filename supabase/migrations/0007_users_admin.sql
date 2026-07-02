-- Full user management for IT admin: soft-delete + password reset tracking + audit log.
--
-- Additions to public.users:
--   - deleted_at            : soft-delete marker (nullable). Never hard-delete because of
--                             FK references from tasks/notifications/activity_log.
--   - password_changed_at   : audit hint — set on every password mutation.
--
-- New table public.user_audit_log:
--   - Every admin mutation on a user row writes 1 audit entry.
--   - Kept separate from activity_log (which is task-scoped, task_id NOT NULL).
--
-- RLS ENABLED with no policies. Server bypasses via secret key.
--
-- Apply: `npx supabase db push` or paste into SQL editor. Then ask Claude to "sync types".

alter table public.users
  add column if not exists deleted_at          timestamptz,
  add column if not exists password_changed_at timestamptz;

create index if not exists users_active_idx
  on public.users (is_active) where deleted_at is null;

create table if not exists public.user_audit_log (
  id             uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.users(id) on delete cascade,
  actor_id       uuid          references public.users(id) on delete set null,
  action         text not null check (action in (
    'create', 'update', 'password_reset', 'soft_delete', 'restore', 'bulk_import'
  )),
  before         jsonb,
  after          jsonb,
  reason         text,
  created_at     timestamptz not null default now()
);

create index if not exists user_audit_target_idx on public.user_audit_log (target_user_id, created_at desc);
create index if not exists user_audit_actor_idx  on public.user_audit_log (actor_id, created_at desc);

alter table public.user_audit_log enable row level security;
