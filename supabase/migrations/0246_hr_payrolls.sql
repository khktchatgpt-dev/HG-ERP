-- 0246_hr_payrolls.sql — Bảng lương theo kỳ (B5, bản vẽ duyệt 18/10/2026, Q1–Q8 theo đề xuất).
--
-- Bảng lương là CHỨNG TỪ, mỗi kỳ một bảng: nháp → chờ duyệt → đã duyệt → đã chi.
-- Tính từ ba nguồn đã khoá: bản chốt kỳ công (0244) × hồ sơ lương (0245) × hệ số (0243).
-- Bảng lương không sửa giờ, không sửa đơn giá — sai ở đâu sửa ở nguồn rồi Tính lại.
--   hr_payrolls        kỳ, trạng thái, lần tính, lần chốt kỳ công + bản cách tính đã dùng,
--                      người/lúc gửi, duyệt, chi, lý do trả lại / rút về nháp.
--   hr_payslips        phiếu mỗi người của lần tính hiện tại: các khoản tổng + `lines` (jsonb:
--                      từng dòng tiền) + `why` (phép tính nguyên văn để bày — nguyên tắc 6).
--   hr_payroll_items   khoản theo kỳ (Q5): tạm ứng, thưởng, truy lĩnh, truy thu, khấu trừ khác.
--   hr_payroll_events  dòng thời gian.
-- Thêm: hr_pay_profiles.flat_tax (Q4 — khấu trừ thẳng 10 %), hr_allowance_types.per_workday
-- (Q2 — Ăn ca tính theo ngày có đi làm).
-- Quyền: hr.payroll.run (Kế toán tính · gửi · chi — luật actions.ts cho accounting.member),
-- hr.payroll.approve (Giám đốc — seed director; không tự duyệt bảng mình gửi, service kiểm).
--
-- RLS: ENABLE, KHÔNG policy → khoá publishable bị chặn, server dùng khoá bí mật.

alter table public.hr_pay_profiles add column if not exists flat_tax boolean not null default false;
alter table public.hr_allowance_types add column if not exists per_workday boolean not null default false;
update public.hr_allowance_types set per_workday = true where name = 'Ăn ca';

create table if not exists public.hr_payrolls (
  id uuid primary key default gen_random_uuid(),
  period text not null unique check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'paid')),
  calc_count integer not null default 0,
  time_close_no integer,
  calc_version_id uuid references public.hr_calc_versions (id) on delete restrict,
  calculated_by uuid references public.users (id) on delete set null,
  calculated_at timestamptz,
  submitted_by uuid references public.users (id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references public.users (id) on delete set null,
  approved_at timestamptz,
  paid_by uuid references public.users (id) on delete set null,
  paid_at timestamptz,
  return_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_hr_payrolls_updated_at on public.hr_payrolls;
create trigger trg_hr_payrolls_updated_at before update on public.hr_payrolls
  for each row execute function public.set_updated_at();

create table if not exists public.hr_payslips (
  id bigint generated always as identity primary key,
  payroll_id uuid not null references public.hr_payrolls (id) on delete cascade,
  calc_no integer not null,
  employee_id uuid not null references public.hr_employees (id) on delete restrict,
  code text not null,
  full_name text not null,
  team text,
  pay_type text not null,
  work_units numeric(8, 2) not null default 0,
  base_pay numeric(14, 0) not null default 0,
  overtime_pay numeric(14, 0) not null default 0,
  leave_pay numeric(14, 0) not null default 0,
  allowance_pay numeric(14, 0) not null default 0,
  item_plus numeric(14, 0) not null default 0,
  gross numeric(14, 0) not null default 0,
  insurance_employee numeric(14, 0) not null default 0,
  insurance_company numeric(14, 0) not null default 0,
  union_fee numeric(14, 0) not null default 0,
  tax numeric(14, 0) not null default 0,
  item_minus numeric(14, 0) not null default 0,
  net numeric(14, 0) not null default 0,
  bank_name text,
  bank_account text,
  lines jsonb not null default '[]'::jsonb,
  why jsonb not null default '[]'::jsonb,
  problems jsonb not null default '[]'::jsonb
);

create index if not exists hr_payslips_payroll_idx on public.hr_payslips (payroll_id, calc_no);

create table if not exists public.hr_payroll_items (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  kind text not null check (kind in ('advance', 'bonus', 'back_pay', 'claw_back', 'deduction')),
  amount numeric(14, 0) not null check (amount > 0),
  note text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hr_payroll_items_period_idx on public.hr_payroll_items (period);

create table if not exists public.hr_payroll_events (
  id bigint generated always as identity primary key,
  payroll_id uuid not null references public.hr_payrolls (id) on delete cascade,
  kind text not null check (kind in (
    'calculate', 'submit', 'withdraw', 'approve', 'return', 'reopen', 'paid'
  )),
  actor_id uuid references public.users (id) on delete set null,
  note text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hr_payroll_events_idx on public.hr_payroll_events (payroll_id, created_at);

insert into public.permissions (key, label, domain, sort_order) values
  ('hr.payroll.run', 'Tính, gửi duyệt và chi bảng lương', 'hr', 81),
  ('hr.payroll.approve', 'Duyệt bảng lương', 'hr', 82)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, 'hr.payroll.approve'
from public.roles r
where r.key = 'director'
on conflict do nothing;

alter table public.hr_payrolls enable row level security;
alter table public.hr_payslips enable row level security;
alter table public.hr_payroll_items enable row level security;
alter table public.hr_payroll_events enable row level security;
