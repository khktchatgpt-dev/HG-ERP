-- 0244_hr_time_periods.sql — Kỳ công: tổ xác nhận, chốt kỳ, mở lại (B3, bản vẽ duyệt 18/10/2026).
--
-- Kỳ công là CHỨNG TỪ: Đang mở → Đã chốt → (Chờ mở lại → Đang mở). Trạng thái là sự thật
-- có người bấm, nên LƯU; kỳ chưa có dòng = đang mở (dòng sinh ở lần chuyển tiếp đầu tiên).
--   hr_time_periods          một dòng mỗi kỳ 'YYYY-MM': khoảng ngày, trạng thái, lần chốt,
--                            bản cách tính lúc chốt, người/lúc chốt, yêu cầu mở lại.
--   hr_period_team_confirms  kỳ × tổ (hr_teams): Nhân sự xác nhận thay sau khi thu phiếu
--                            giấy có chữ ký; số ngày thiếu lượt tổ đồng ý tính 0 giờ (Q1, Q2).
--                            Phiếu điều chỉnh được duyệt cho người của tổ → dòng bị xoá (Q4).
--   hr_time_results          BẢN CHỐT: kỳ × lần chốt × người × ngày — phút theo khung (jsonb),
--                            phút làm trưa quy đổi, loại nghỉ, ngày thiếu tính 0 giờ, tổ lúc chốt.
--                            Người không chấm công: một dòng exempt, work_date null (Q6).
--                            Bảng lương (B5) và Bảng công của kỳ đã chốt đọc từ đây.
--   hr_period_events         dòng thời gian: việc, người, lúc, lý do.
-- Quyền: hr.period.close (chốt kỳ), hr.period.reopen_decide (duyệt mở lại) — seed director;
-- admin gán thêm cho Trưởng phòng Nhân sự qua màn Phân quyền (Q7).
--
-- RLS: ENABLE, KHÔNG policy → khoá publishable bị chặn, server dùng khoá bí mật.

create table if not exists public.hr_time_periods (
  id uuid primary key default gen_random_uuid(),
  period text not null unique check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  date_from date not null,
  date_to date not null,
  status text not null default 'open' check (status in ('open', 'closed', 'reopen_requested')),
  close_count integer not null default 0,
  calc_version_id uuid references public.hr_calc_versions (id) on delete restrict,
  closed_by uuid references public.users (id) on delete set null,
  closed_at timestamptz,
  reopen_reason text,
  reopen_by uuid references public.users (id) on delete set null,
  reopen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_to > date_from)
);

drop trigger if exists trg_hr_time_periods_updated_at on public.hr_time_periods;
create trigger trg_hr_time_periods_updated_at before update on public.hr_time_periods
  for each row execute function public.set_updated_at();

create table if not exists public.hr_period_team_confirms (
  period_id uuid not null references public.hr_time_periods (id) on delete cascade,
  team_id uuid not null references public.hr_teams (id) on delete cascade,
  zero_days integer not null default 0 check (zero_days >= 0),
  paper_signed boolean not null default true,
  confirmed_by uuid references public.users (id) on delete set null,
  confirmed_at timestamptz not null default now(),
  primary key (period_id, team_id)
);

create table if not exists public.hr_time_results (
  id bigint generated always as identity primary key,
  period_id uuid not null references public.hr_time_periods (id) on delete cascade,
  close_no integer not null,
  employee_id uuid not null references public.hr_employees (id) on delete restrict,
  code text not null,
  full_name text not null,
  team text,
  work_date date,
  frame_minutes jsonb not null default '{}'::jsonb,
  lunch_minutes integer not null default 0,
  total_minutes integer not null default 0,
  leave_type text,
  zero_day boolean not null default false,
  exempt boolean not null default false,
  check (exempt or work_date is not null)
);

create index if not exists hr_time_results_period_idx
  on public.hr_time_results (period_id, close_no);

create table if not exists public.hr_period_events (
  id bigint generated always as identity primary key,
  period_id uuid not null references public.hr_time_periods (id) on delete cascade,
  kind text not null check (kind in (
    'team_confirm', 'team_unconfirm', 'close', 'reopen_request', 'reopen_withdraw',
    'reopen_approve', 'reopen_reject'
  )),
  team_id uuid references public.hr_teams (id) on delete set null,
  actor_id uuid references public.users (id) on delete set null,
  note text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hr_period_events_period_idx
  on public.hr_period_events (period_id, created_at);

insert into public.permissions (key, label, domain, sort_order) values
  ('hr.period.close', 'Chốt kỳ công', 'hr', 78),
  ('hr.period.reopen_decide', 'Duyệt mở lại kỳ công đã chốt', 'hr', 79)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join (values ('hr.period.close'), ('hr.period.reopen_decide')) as p(key)
where r.key = 'director'
on conflict do nothing;

alter table public.hr_time_periods enable row level security;
alter table public.hr_period_team_confirms enable row level security;
alter table public.hr_time_results enable row level security;
alter table public.hr_period_events enable row level security;
