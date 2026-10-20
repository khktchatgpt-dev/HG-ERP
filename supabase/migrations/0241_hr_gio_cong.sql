-- 0241_hr_gio_cong.sql — Giờ công theo khung: cách tính theo bộ phận + tick làm trưa.
--
-- Luật tính công thật của Nhân sự (file "Thống kê giờ theo khung T9-2026 - Tổ sơn sắt",
-- chủ dự án gửi + duyệt 5 câu 17/10/2026):
--   hr_team_calc_rules  bộ phận nào tính THEO KHUNG giờ (sản xuất, mặc định) hay THEO NGÀY
--                       (văn phòng chỉ quẹt 1 lần/ngày — theo khung sẽ ra 0 giờ; câu 1).
--                       Bộ phận không có dòng = theo khung. Khoá là tên bộ phận (text, khớp
--                       hr_employees.team) — bộ phận là nhãn gõ tự do, không có bảng danh mục.
--   hr_lunch_ticks      sổ tay làm trưa của tổ trưởng: số phút làm xuyên trưa 11–12 của một
--                       người một ngày; giờ cộng = phút × hệ số (2) ÷ 60 vào khung hành chính.
--                       Một dòng mỗi người mỗi ngày; bỏ tick = xoá dòng (đây là ô sổ tay, không
--                       phải chứng từ — vết ai tick lúc nào giữ ở created_by / updated_at).
--
-- RLS: ENABLE, KHÔNG policy → khoá publishable bị chặn, server dùng khoá bí mật.

create table if not exists public.hr_team_calc_rules (
  team text primary key,
  calc_mode text not null default 'khung' check (calc_mode in ('khung', 'ngay')),
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_hr_team_calc_rules_updated_at on public.hr_team_calc_rules;
create trigger trg_hr_team_calc_rules_updated_at before update on public.hr_team_calc_rules
  for each row execute function public.set_updated_at();

-- Khối văn phòng đo được 17/10/2026: chỉ 1 lượt mỗi ngày.
insert into public.hr_team_calc_rules (team, calc_mode) values
  ('Phòng Kế Toán', 'ngay'),
  ('Phòng Kế Hoạch', 'ngay'),
  ('Phòng Kỹ Thuật', 'ngay'),
  ('Phòng Nhân Sự', 'ngay')
on conflict (team) do nothing;

create table if not exists public.hr_lunch_ticks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  work_date date not null,
  minutes integer not null check (minutes > 0 and minutes <= 240),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index if not exists hr_lunch_ticks_date_idx on public.hr_lunch_ticks (work_date);

drop trigger if exists trg_hr_lunch_ticks_updated_at on public.hr_lunch_ticks;
create trigger trg_hr_lunch_ticks_updated_at before update on public.hr_lunch_ticks
  for each row execute function public.set_updated_at();

alter table public.hr_team_calc_rules enable row level security;
alter table public.hr_lunch_ticks enable row level security;
