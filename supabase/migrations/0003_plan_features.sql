-- Self-planning, sub-tasks, department heads.

------------------------------------------------------------
-- 1. Tasks: planning + sub-tasks + categorization
------------------------------------------------------------

alter table public.tasks
  add column if not exists kind text not null default 'assigned'
    check (kind in ('assigned', 'self')),
  add column if not exists category text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists estimate_hours numeric(5,2)
    check (estimate_hours is null or estimate_hours between 0 and 9999.99),
  add column if not exists actual_hours numeric(5,2)
    check (actual_hours is null or actual_hours between 0 and 9999.99),
  add column if not exists parent_id uuid references public.tasks(id) on delete cascade,
  add column if not exists planned_date date;

create index if not exists tasks_assignee_planned_idx
  on public.tasks (assignee_id, planned_date) where planned_date is not null;
create index if not exists tasks_parent_idx
  on public.tasks (parent_id) where parent_id is not null;
create index if not exists tasks_kind_idx on public.tasks (kind);

-- Refresh the summary view so app code sees the new columns.
create or replace view public.v_task_summary as
  select
    t.*,
    a.name as assignee_name, a.email as assignee_email,
    g.name as assigner_name, g.email as assigner_email,
    d.name as department_name
  from public.tasks t
  join public.users a on a.id = t.assignee_id
  join public.users g on g.id = t.assigner_id
  left join public.departments d on d.id = t.department_id;

------------------------------------------------------------
-- 2. Departments: head_user_id (Trưởng BP)
------------------------------------------------------------

alter table public.departments
  add column if not exists head_user_id uuid references public.users(id) on delete set null;

create index if not exists departments_head_idx on public.departments (head_user_id);
