-- 0245_hr_pay_profiles.sql — Hồ sơ lương nhân viên có hiệu lực theo kỳ (B4, bản vẽ duyệt 18/10/2026).
--
-- Danh mục CÓ HIỆU LỰC, không phải chứng từ (không vòng duyệt):
--   hr_pay_profiles            người × "từ kỳ" 'YYYY-MM': cách trả (theo công | theo tháng),
--                              đơn giá một công / lương tháng, lương đóng BH, có tham gia BH,
--                              số người phụ thuộc. Kỳ X dùng bản có from_period lớn nhất ≤ X
--                              (cùng luật Cách tính công 0243). Bản đã dùng cho kỳ đã chốt chỉ
--                              xem — đổi thì thêm bản mới từ kỳ sau (service kiểm).
--   hr_allowance_types         danh mục phụ cấp cố định (Kế toán sửa): có tính BH, có chịu thuế.
--   hr_pay_profile_allowances  số tiền từng phụ cấp trong một bản.
--   hr_employee_private        CCCD, MST, ngân hàng, số tài khoản, ngày vào làm — tách bảng riêng
--                              để ranh giới quyền rõ: chỉ đọc qua quyền hr.payroll.profile.
--   hr_private_access_log      mỗi lần bấm "Hiện" số tài khoản / CCCD / MST — ai, lúc nào, ô nào.
-- Quyền hr.payroll.profile (xem + sửa): Kế toán có sẵn qua accounting.member (luật trong
-- actions.ts); seed director; admin gán thêm Trưởng phòng Nhân sự qua màn Phân quyền (Q4).
--
-- RLS: ENABLE, KHÔNG policy → khoá publishable bị chặn, server dùng khoá bí mật.

create table if not exists public.hr_pay_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  from_period text not null check (from_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  pay_type text not null check (pay_type in ('daily', 'monthly')),
  daily_rate numeric(14, 2) check (daily_rate is null or daily_rate >= 0),
  monthly_salary numeric(14, 2) check (monthly_salary is null or monthly_salary >= 0),
  insurance_salary numeric(14, 2) check (insurance_salary is null or insurance_salary >= 0),
  insured boolean not null default true,
  dependents integer not null default 0 check (dependents between 0 and 20),
  note text,
  source text,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, from_period),
  check (
    (pay_type = 'daily' and daily_rate is not null)
    or (pay_type = 'monthly' and monthly_salary is not null)
  )
);

create index if not exists hr_pay_profiles_period_idx on public.hr_pay_profiles (from_period);

drop trigger if exists trg_hr_pay_profiles_updated_at on public.hr_pay_profiles;
create trigger trg_hr_pay_profiles_updated_at before update on public.hr_pay_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.hr_allowance_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 60),
  insurable boolean not null default false,
  taxable boolean not null default true,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.hr_allowance_types (name, insurable, taxable, sort_order) values
  ('Ăn ca', false, false, 10),
  ('Chuyên cần', false, true, 20),
  ('Trách nhiệm', true, true, 30),
  ('Xăng xe – điện thoại', false, true, 40)
on conflict (name) do nothing;

create table if not exists public.hr_pay_profile_allowances (
  profile_id uuid not null references public.hr_pay_profiles (id) on delete cascade,
  allowance_type_id uuid not null references public.hr_allowance_types (id) on delete restrict,
  amount numeric(14, 2) not null check (amount >= 0),
  primary key (profile_id, allowance_type_id)
);

create table if not exists public.hr_employee_private (
  employee_id uuid primary key references public.hr_employees (id) on delete cascade,
  national_id text check (national_id is null or national_id ~ '^\d{9,12}$'),
  tax_code text check (tax_code is null or tax_code ~ '^\d{10}(\d{2,3})?$'),
  bank_name text,
  bank_account text check (bank_account is null or bank_account ~ '^[0-9A-Za-z]{4,30}$'),
  join_date date,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_hr_employee_private_updated_at on public.hr_employee_private;
create trigger trg_hr_employee_private_updated_at before update on public.hr_employee_private
  for each row execute function public.set_updated_at();

create table if not exists public.hr_private_access_log (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  field text not null check (field in ('bank_account', 'national_id', 'tax_code')),
  viewer_id uuid references public.users (id) on delete set null,
  viewed_at timestamptz not null default now()
);

create index if not exists hr_private_access_log_emp_idx
  on public.hr_private_access_log (employee_id, viewed_at desc);

insert into public.permissions (key, label, domain, sort_order) values
  ('hr.payroll.profile', 'Xem và sửa hồ sơ lương nhân viên', 'hr', 80)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, 'hr.payroll.profile'
from public.roles r
where r.key = 'director'
on conflict do nothing;

alter table public.hr_pay_profiles enable row level security;
alter table public.hr_allowance_types enable row level security;
alter table public.hr_pay_profile_allowances enable row level security;
alter table public.hr_employee_private enable row level security;
alter table public.hr_private_access_log enable row level security;
