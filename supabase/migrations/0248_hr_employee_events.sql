-- 0248_hr_employee_events.sql — Biến động nhân sự có ngày + lý do (Hồ sơ nhân viên B1, bản vẽ
-- duyệt 19/10/2026, Q1–Q7 theo đề xuất). Chép SAP personnel action / Odoo departure reason.
--
-- Trước đây nghỉ việc chỉ là cờ hr_employees.active, không ngày, không lý do: người nghỉ giữa
-- kỳ rơi khỏi kỳ công / bảng lương của kỳ đó. Nay:
--   hr_employees.hire_date     ngày vào làm (đoạn làm việc hiện tại). Nguồn DUY NHẤT — Hồ sơ
--                              lương chỉ đọc. hr_employee_private.join_date (0245, 0/152 có số)
--                              được chép sang rồi thôi dùng.
--   hr_employees.leave_date    NGÀY LÀM VIỆC CUỐI; còn trong kỳ công / lương tới hết ngày này.
--   hr_employees.leave_reason  resign | contract_end | terminated | dismissed | retired | other.
--   hr_employees.job_title     chức danh, gõ tự do + gợi ý (Q7).
--   hr_employee_events         vết biến động: hire | leave | rehire | transfer, ngày hiệu lực,
--                              trước/sau. Huỷ = đánh dấu cancelled_at, không xoá.
--   hr_apply_due_leaves(d)     lật active=false cho người có ngày làm cuối < d. Service gọi trước
--                              khi đọc danh sách — trigger 0247 khoá tài khoản ERP lúc đó.
--
-- RLS: bật, không policy (anon bị chặn, khoá bí mật đi qua).

alter table public.hr_employees add column if not exists hire_date date;
alter table public.hr_employees add column if not exists leave_date date;
alter table public.hr_employees add column if not exists leave_reason text;
alter table public.hr_employees add column if not exists job_title text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hr_employees_leave_reason_check') then
    alter table public.hr_employees add constraint hr_employees_leave_reason_check
      check (leave_reason is null or leave_reason in
        ('resign', 'contract_end', 'terminated', 'dismissed', 'retired', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hr_employees_leave_after_hire') then
    alter table public.hr_employees add constraint hr_employees_leave_after_hire
      check (leave_date is null or hire_date is null or leave_date >= hire_date);
  end if;
end $$;

update public.hr_employees e set hire_date = p.join_date
from public.hr_employee_private p
where p.employee_id = e.id and p.join_date is not null and e.hire_date is null;

create table if not exists public.hr_employee_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  kind text not null check (kind in ('hire', 'leave', 'rehire', 'transfer')),
  effective_date date not null,
  reason text,
  note text,
  before jsonb,
  after jsonb,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.users (id) on delete set null
);
create index if not exists hr_employee_events_emp_idx
  on public.hr_employee_events (employee_id, effective_date desc);
alter table public.hr_employee_events enable row level security;

create or replace function public.hr_apply_due_leaves(p_today date)
returns integer language plpgsql set search_path = public as $$
declare n integer;
begin
  update public.hr_employees set active = false
  where active and leave_date is not null and leave_date < p_today;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.hr_apply_due_leaves(date) from public, anon, authenticated;
