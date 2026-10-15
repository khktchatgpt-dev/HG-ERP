-- 0232_hr_cham_cong.sql — Chấm công: lấy lượt quẹt thẳng từ máy ZKTeco và tính công.
--
-- Bước 1 (12/10/2026). Sáu bảng:
--   hr_shifts               ca làm việc (giờ vào/ra, nghỉ, số lượt bắt buộc, tăng ca từ)
--   hr_holidays             ngày lễ — người đi làm ngày lễ tính tăng ca lễ
--   hr_attendance_devices   máy chấm công (IP, serial, lần kéo cuối, số lượt / sức chứa)
--   hr_employees            nhân viên chấm công — CÔNG NHÂN KHÔNG CÓ TÀI KHOẢN ERP nên
--                           không FK sang users (chủ dự án chốt câu 7, 12/10/2026)
--   hr_device_users         (máy, mã trên máy) → nhân viên. Ghép THEO TỪNG MÁY vì đo
--                           12/10: 31 mã trùng số trên 2 máy là HAI NGƯỜI KHÁC NHAU
--   hr_attendance_logs      lượt quẹt thô, BẤT BIẾN; khoá duy nhất (máy, mã, giờ).
--                           Không dùng số thứ tự của máy làm khoá: nó 2 byte, quay vòng.
--
-- Giờ quẹt máy ghi theo giờ tường Việt Nam, lưu timestamptz với múi +07.
-- Lượt bù / chốt bảng công là bước sau, chưa có bảng ở đây.
--
-- RLS: ENABLE, KHÔNG policy trên mọi bảng → khoá publishable bị chặn hết, server
-- dùng khoá bí mật đi vòng. Mọi truy cập qua /api/dept/hr/cham-cong/*.

-- ── Ca làm việc ──────────────────────────────────────────────────────────────
create table if not exists public.hr_shifts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 60 check (break_minutes >= 0),
  -- 1 = chỉ cần lượt vào (văn phòng), 2 = phải có vào + ra
  required_punches smallint not null default 2 check (required_punches in (1, 2)),
  ot_from time not null,
  ot_round_minutes integer not null default 30 check (ot_round_minutes > 0),
  late_grace_minutes integer not null default 5 check (late_grace_minutes >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_hr_shifts_updated_at on public.hr_shifts;
create trigger trg_hr_shifts_updated_at before update on public.hr_shifts
  for each row execute function public.set_updated_at();

-- Ba ca suy từ giờ quẹt tháng 9/2026, chủ dự án duyệt 12/10/2026.
insert into public.hr_shifts
  (code, name, start_time, end_time, break_minutes, required_punches, ot_from, sort_order)
values
  ('XUONG', 'Xưởng',     '07:00', '16:00',  60, 2, '16:00', 1),
  ('VP',    'Văn phòng', '08:00', '17:00',  60, 1, '17:00', 2),
  ('BEP',   'Bếp',       '03:30', '15:30', 240, 2, '15:30', 3)
on conflict (code) do nothing;

-- ── Ngày lễ ──────────────────────────────────────────────────────────────────
create table if not exists public.hr_holidays (
  holiday_date date primary key,
  name text not null,
  created_at timestamptz not null default now()
);

-- Chỉ nạp ngày dương lịch cố định + ngày đã thấy trong dữ liệu (02/09 không ai quẹt).
-- Tết, Giỗ Tổ theo âm lịch: Nhân sự nhập mỗi năm.
insert into public.hr_holidays (holiday_date, name) values
  ('2026-01-01', 'Tết Dương lịch'),
  ('2026-04-30', 'Ngày Thống nhất'),
  ('2026-05-01', 'Quốc tế Lao động'),
  ('2026-09-02', 'Quốc khánh')
on conflict (holiday_date) do nothing;

-- ── Máy chấm công ────────────────────────────────────────────────────────────
create table if not exists public.hr_attendance_devices (
  id uuid primary key default gen_random_uuid(),
  ip text not null unique,
  port integer not null default 4370,
  name text not null,
  serial text,
  last_pulled_at timestamptz,
  last_log_count integer,
  log_capacity integer,
  last_user_count integer,
  last_error text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_hr_attendance_devices_updated_at on public.hr_attendance_devices;
create trigger trg_hr_attendance_devices_updated_at before update on public.hr_attendance_devices
  for each row execute function public.set_updated_at();

insert into public.hr_attendance_devices (ip, name) values
  ('192.168.1.201', 'Máy .201'),
  ('192.168.1.203', 'Máy .203')
on conflict (ip) do nothing;

-- ── Nhân viên chấm công ──────────────────────────────────────────────────────
create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  shift_id uuid not null references public.hr_shifts (id) on delete restrict,
  team text,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_hr_employees_updated_at on public.hr_employees;
create trigger trg_hr_employees_updated_at before update on public.hr_employees
  for each row execute function public.set_updated_at();

-- ── Mã trên máy → nhân viên ──────────────────────────────────────────────────
create table if not exists public.hr_device_users (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.hr_attendance_devices (id) on delete cascade,
  device_user_id text not null,
  name_on_device text,
  employee_id uuid references public.hr_employees (id) on delete set null,
  -- true khi cùng số mã ở máy kia mang tên khác: Nhân sự phải xem lại
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, device_user_id)
);

create index if not exists hr_device_users_employee_idx on public.hr_device_users (employee_id);

drop trigger if exists trg_hr_device_users_updated_at on public.hr_device_users;
create trigger trg_hr_device_users_updated_at before update on public.hr_device_users
  for each row execute function public.set_updated_at();

-- ── Lượt quẹt thô ────────────────────────────────────────────────────────────
create table if not exists public.hr_attendance_logs (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.hr_attendance_devices (id) on delete restrict,
  device_user_id text not null,
  punched_at timestamptz not null,
  -- kiểu xác thực của máy: 1 = vân tay, 15 = khuôn mặt
  verify_type smallint,
  -- vào/ra theo máy (255 = máy không ghi). Tháng 9/2026 không ai bấm nên KHÔNG dùng để tính.
  state smallint,
  created_at timestamptz not null default now(),
  unique (device_id, device_user_id, punched_at)
);

create index if not exists hr_attendance_logs_punched_idx on public.hr_attendance_logs (punched_at);

-- ── RLS: bật, không policy ───────────────────────────────────────────────────
alter table public.hr_shifts enable row level security;
alter table public.hr_holidays enable row level security;
alter table public.hr_attendance_devices enable row level security;
alter table public.hr_employees enable row level security;
alter table public.hr_device_users enable row level security;
alter table public.hr_attendance_logs enable row level security;
