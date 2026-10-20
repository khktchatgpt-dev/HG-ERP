-- 0243_hr_calc_versions.sql — Cách tính công có phiên bản theo kỳ (B2, bản vẽ duyệt 18/10/2026).
--
-- Trước đây 16 tham số khung giờ nằm cứng trong code (THAM_SO_MAC_DINH): đổi một số là
-- sửa code, và mọi tháng cũ tính lại theo số mới. Nay:
--   hr_calc_versions  một BẢN cách tính: quy tắc đơn (nghỉ trưa, ân hạn, làm tròn…) + trạng
--                     thái. Nháp (from_period null) → Áp dụng từ kỳ 'YYYY-MM'. Kỳ X dùng bản
--                     đã áp dụng có from_period lớn nhất ≤ X. Mỗi kỳ chỉ một bản bắt đầu.
--   hr_calc_frames    6 khung giờ của mỗi bản (phút từ 0h ngày bắt đầu ca, qua 0h > 1440),
--                     cờ "bỏ phần lố" dùng khi làm tròn kiểu xuống 30 phút theo khung.
--   hr_calc_rates     hệ số lương (% ) của bản: theo khung × loại ngày (thường / CN / lễ), và
--                     theo loại nghỉ (P, R, CT, Ô, KL, lễ không làm). Ô trống = chưa nhập.
--                     Thấp hơn mức luật thì bắt ghi lý do (below_law_reason) — cảnh báo, không
--                     chặn (câu Q3).
-- Quyền: hr.calc.rates_edit (Kế toán sửa hệ số), hr.calc.rules_edit (Nhân sự sửa khung +
-- quy tắc). Director được seed cả hai; admin luôn qua.
--
-- Bản 1 = ĐÚNG các số đang trong code, áp dụng từ kỳ 2026-09, nên Bảng giờ công không đổi số
-- sau khi chuyển sang đọc bản. Hệ số lương để trống (Kế toán chưa nhập — cột F file Excel trống).
--
-- RLS: ENABLE, KHÔNG policy → khoá publishable bị chặn, server dùng khoá bí mật.

create table if not exists public.hr_calc_versions (
  id uuid primary key default gen_random_uuid(),
  version_no integer not null unique,
  from_period text check (from_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'draft' check (status in ('draft', 'applied')),
  lunch_from integer not null,
  lunch_to integer not null,
  grace_minutes integer not null check (grace_minutes between 0 and 120),
  round_out_mode text not null default 'bac_thang' check (round_out_mode in ('bac_thang', 'xuong_30')),
  half_threshold integer not null check (half_threshold between 0 and 59),
  full_threshold integer not null check (full_threshold between 0 and 59),
  round_in_afternoon boolean not null default true,
  count_early boolean not null default false,
  early_from integer not null,
  night_before integer not null,
  minutes_per_cong integer not null check (minutes_per_cong between 60 and 720),
  lunch_factor numeric(4, 2) not null check (lunch_factor >= 0),
  lunch_default_minutes integer not null check (lunch_default_minutes between 1 and 240),
  note text,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  applied_by uuid references public.users (id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lunch_to > lunch_from),
  check (half_threshold <= full_threshold),
  check ((status = 'applied') = (from_period is not null))
);

create unique index if not exists hr_calc_versions_from_period_uidx
  on public.hr_calc_versions (from_period) where status = 'applied';

drop trigger if exists trg_hr_calc_versions_updated_at on public.hr_calc_versions;
create trigger trg_hr_calc_versions_updated_at before update on public.hr_calc_versions
  for each row execute function public.set_updated_at();

create table if not exists public.hr_calc_frames (
  version_id uuid not null references public.hr_calc_versions (id) on delete cascade,
  code text not null check (code ~ '^K[1-9]$'),
  name text not null check (length(trim(name)) between 1 and 60),
  from_minute integer not null check (from_minute between 0 and 2880),
  to_minute integer not null check (to_minute between 0 and 2880),
  drop_remainder boolean not null default true,
  is_office boolean not null default false,
  primary key (version_id, code),
  check (to_minute > from_minute)
);

create table if not exists public.hr_calc_rates (
  version_id uuid not null references public.hr_calc_versions (id) on delete cascade,
  -- 'frame' = khung × loại ngày · 'leave' = loại nghỉ (day_kind = 'any')
  kind text not null check (kind in ('frame', 'leave')),
  code text not null,
  day_kind text not null check (day_kind in ('thuong', 'cn', 'le', 'any')),
  percent numeric(6, 2) check (percent is null or percent between 0 and 1000),
  below_law_reason text,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (version_id, kind, code, day_kind)
);

drop trigger if exists trg_hr_calc_rates_updated_at on public.hr_calc_rates;
create trigger trg_hr_calc_rates_updated_at before update on public.hr_calc_rates
  for each row execute function public.set_updated_at();

-- Bản 1: số đang trong code (gio-khung.ts THAM_SO_MAC_DINH, file tổ Sơn sắt 17/10/2026).
insert into public.hr_calc_versions (
  version_no, from_period, status, lunch_from, lunch_to, grace_minutes, round_out_mode,
  half_threshold, full_threshold, round_in_afternoon, count_early, early_from, night_before,
  minutes_per_cong, lunch_factor, lunch_default_minutes, note, applied_at
) values (
  1, '2026-09', 'applied', 660, 720, 30, 'bac_thang', 20, 50, true, false, 300, 300,
  480, 2, 60, 'Nạp từ luật đang chạy (file Thống kê giờ theo khung T9 — Tổ sơn sắt)', now()
) on conflict (version_no) do nothing;

insert into public.hr_calc_frames (version_id, code, name, from_minute, to_minute, drop_remainder, is_office)
select v.id, f.code, f.name, f.fm, f.tm, f.dr, f.io
from public.hr_calc_versions v
cross join (values
  ('K1', 'Ca hành chính', 420, 960, false, true),
  ('K2', '16h – 19h', 960, 1140, true, false),
  ('K3', '19h – 22h', 1140, 1320, true, false),
  ('K4', '22h – 24h', 1320, 1440, true, false),
  ('K5', '24h – 5h', 1440, 1740, true, false),
  ('K6', '5h – 7h', 1740, 1860, true, false)
) as f(code, name, fm, tm, dr, io)
where v.version_no = 1
on conflict (version_id, code) do nothing;

-- Ô hệ số của Bản 1, để trống (null) cho Kế toán nhập. KL cố định 0.
insert into public.hr_calc_rates (version_id, kind, code, day_kind, percent)
select v.id, 'frame', k.code, d.day_kind, null
from public.hr_calc_versions v
cross join (values ('K1'), ('K2'), ('K3'), ('K4'), ('K5'), ('K6')) as k(code)
cross join (values ('thuong'), ('cn'), ('le')) as d(day_kind)
where v.version_no = 1
on conflict do nothing;

insert into public.hr_calc_rates (version_id, kind, code, day_kind, percent)
select v.id, 'leave', l.code, 'any', l.pct
from public.hr_calc_versions v
cross join (values
  ('annual', null::numeric), ('holiday', null), ('personal', null),
  ('business_trip', null), ('sick', null), ('unpaid', 0)
) as l(code, pct)
where v.version_no = 1
on conflict do nothing;

insert into public.permissions (key, label, domain, sort_order) values
  ('hr.calc.rates_edit', 'Sửa hệ số lương trong Cách tính công', 'hr', 76),
  ('hr.calc.rules_edit', 'Sửa khung giờ và quy tắc tính công', 'hr', 77)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join (values ('hr.calc.rates_edit'), ('hr.calc.rules_edit')) as p(key)
where r.key = 'director'
on conflict do nothing;

alter table public.hr_calc_versions enable row level security;
alter table public.hr_calc_frames enable row level security;
alter table public.hr_calc_rates enable row level security;
