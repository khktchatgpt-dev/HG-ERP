-- Task codes, progress %, period, on_hold status, employee codes, settings.

drop view if exists public.v_task_summary;

-- 1. Mở rộng status: thêm 'on_hold'
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('todo','in_progress','submitted','done','rejected','cancelled','on_hold'));

-- 2. Trường mới cho tasks
alter table public.tasks
  add column if not exists task_code text unique,
  add column if not exists progress_percent smallint not null default 0
    check (progress_percent between 0 and 100),
  add column if not exists period_month date;

create index if not exists tasks_task_code_idx on public.tasks (task_code);
create index if not exists tasks_period_month_idx on public.tasks (period_month);

-- 3. Auto-generate task_code dạng CV-000001
create sequence if not exists public.task_code_seq start 1;
create or replace function public.gen_task_code() returns trigger
language plpgsql as $$
begin
  if new.task_code is null then
    new.task_code := 'CV-' || lpad(nextval('public.task_code_seq')::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_tasks_code on public.tasks;
create trigger trg_tasks_code before insert on public.tasks
  for each row execute function public.gen_task_code();

-- Backfill cho các task đã tồn tại
update public.tasks
  set task_code = 'CV-' || lpad(nextval('public.task_code_seq')::text, 6, '0')
  where task_code is null;

-- 4. Tự động đặt progress=100 khi done; 0 khi cancelled
create or replace function public.tasks_sync_progress() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'done' then new.progress_percent := 100;
    elsif new.status = 'cancelled' and old.progress_percent = 0 then new.progress_percent := 0;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_tasks_sync_progress on public.tasks;
create trigger trg_tasks_sync_progress before update on public.tasks
  for each row execute function public.tasks_sync_progress();

-- 5. employee_code cho users
alter table public.users add column if not exists employee_code text unique;

-- 6. Settings table (key/value)
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.settings disable row level security;

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (key, value) values
  ('company_name',          '"Công ty SXTM Hoang Gia"'::jsonb),
  ('report_email',          '"khktchatgpt@gmail.com"'::jsonb),
  ('reminder_days_before',  '1'::jsonb),
  ('notifications_enabled', 'true'::jsonb)
on conflict (key) do nothing;

-- 7. Re-create view với cột mới
create view public.v_task_summary as
  select
    t.*,
    a.name as assignee_name, a.email as assignee_email,
    g.name as assigner_name, g.email as assigner_email,
    d.name as department_name
  from public.tasks t
  join public.users a on a.id = t.assignee_id
  join public.users g on g.id = t.assigner_id
  left join public.departments d on d.id = t.department_id;
