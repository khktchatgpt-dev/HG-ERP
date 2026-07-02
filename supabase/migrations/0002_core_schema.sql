-- Core schema for the Task Manager (departments, tasks, comments,
-- notifications, activity log).
--
-- RLS is ENABLED with NO policies on every table here: the anon/publishable key
-- is fully blocked, while the server (SUPABASE_SECRET_KEY / service_role) bypasses
-- RLS. All access goes through server-side API routes that enforce per-role /
-- per-row permissions in application code (see src/server/permissions.ts).
-- Never expose the secret key to the browser.
--
-- Apply: paste into the SQL editor, or `npx supabase db push`.

------------------------------------------------------------
-- 1. Reusable helpers
------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

------------------------------------------------------------
-- 2. Departments
------------------------------------------------------------

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_departments_updated_at on public.departments;
create trigger trg_departments_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

alter table public.departments enable row level security;

------------------------------------------------------------
-- 3. Users — extend the existing table from 0001_users.sql
------------------------------------------------------------

alter table public.users
  add column if not exists role text not null default 'employee'
    check (role in ('admin', 'manager', 'employee')),
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists title text,                       -- chức danh
  add column if not exists avatar_url text,
  add column if not exists is_active boolean not null default true,
  add column if not exists last_login_at timestamptz;

create index if not exists users_department_idx on public.users (department_id);
create index if not exists users_role_idx       on public.users (role) where is_active;

-- users was created in 0001 with RLS disabled on older deployments; enforce here too.
alter table public.users enable row level security;

------------------------------------------------------------
-- 4. Tasks
------------------------------------------------------------

create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(title) between 1 and 200),
  description    text,
  status         text not null default 'todo'
    check (status in ('todo', 'in_progress', 'submitted', 'done', 'rejected', 'cancelled')),
  priority       text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),

  assigner_id    uuid not null references public.users(id) on delete restrict, -- người giao
  assignee_id    uuid not null references public.users(id) on delete restrict, -- người làm
  department_id  uuid          references public.departments(id) on delete set null,

  due_date       timestamptz,
  started_at     timestamptz,
  submitted_at   timestamptz,
  completed_at   timestamptz,   -- set khi status -> done
  cancelled_at   timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists tasks_assignee_status_idx  on public.tasks (assignee_id, status);
create index if not exists tasks_assigner_status_idx  on public.tasks (assigner_id, status);
create index if not exists tasks_department_idx       on public.tasks (department_id);
create index if not exists tasks_due_date_idx         on public.tasks (due_date) where status in ('todo','in_progress','submitted');
create index if not exists tasks_created_desc_idx     on public.tasks (created_at desc);

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Auto-stamp lifecycle timestamps when status transitions.
create or replace function public.tasks_stamp_status()
returns trigger language plpgsql
set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'in_progress' and old.started_at is null then
      new.started_at := now();
    elsif new.status = 'submitted' then
      new.submitted_at := now();
    elsif new.status = 'done' then
      new.completed_at := now();
    elsif new.status = 'cancelled' then
      new.cancelled_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_tasks_stamp_status on public.tasks;
create trigger trg_tasks_stamp_status
  before update on public.tasks
  for each row execute function public.tasks_stamp_status();

alter table public.tasks enable row level security;

------------------------------------------------------------
-- 5. Task comments (kiêm "báo cáo tiến độ")
------------------------------------------------------------

create table if not exists public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete restrict,
  body       text not null check (char_length(body) between 1 and 4000),
  kind       text not null default 'comment'
    check (kind in ('comment', 'progress_report', 'approval', 'rejection', 'system')),
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);

alter table public.task_comments enable row level security;

------------------------------------------------------------
-- 6. Notifications (in-app)
------------------------------------------------------------

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,    -- recipient
  actor_id   uuid          references public.users(id) on delete set null,    -- who caused it
  task_id    uuid          references public.tasks(id) on delete cascade,
  type       text not null
    check (type in ('assigned','reassigned','status_changed','submitted',
                    'approved','rejected','commented','due_soon','overdue')),
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

------------------------------------------------------------
-- 7. Activity log (audit trail per task)
------------------------------------------------------------

create table if not exists public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  actor_id   uuid          references public.users(id) on delete set null,
  action     text not null
    check (action in ('created','updated','reassigned','status_changed',
                      'commented','attachment_added','attachment_removed','deleted')),
  payload    jsonb not null default '{}'::jsonb,   -- e.g. {from:'todo', to:'in_progress'}
  created_at timestamptz not null default now()
);

create index if not exists activity_log_task_idx on public.activity_log (task_id, created_at);

alter table public.activity_log enable row level security;

------------------------------------------------------------
-- 8. Convenience views (optional, for dashboards)
------------------------------------------------------------

-- security_invoker: the view runs with the querying role's privileges, so it
-- respects RLS on the underlying tables (anon stays blocked; the server's secret
-- key still bypasses). Without this a view can leak RLS-protected rows.
create or replace view public.v_task_summary
  with (security_invoker = on) as
  select
    t.*,
    a.name  as assignee_name,  a.email as assignee_email,
    g.name  as assigner_name,  g.email as assigner_email,
    d.name  as department_name
  from public.tasks t
  join public.users a on a.id = t.assignee_id
  join public.users g on g.id = t.assigner_id
  left join public.departments d on d.id = t.department_id;
