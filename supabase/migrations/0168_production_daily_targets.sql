-- 0168: production_daily_targets — CHỈ TIÊU sản lượng NGÀY × TỔ × CÔNG ĐOẠN
-- (GĐ 2.2 plan-sx-gd2-3, user chốt hoàn thiện 23/08/2026). Khớp sổ thật của
-- thống kê (ma trận ngày×tổ×công đoạn), KHÔNG chẻ theo dòng SP — giao chỉ
-- tiêu theo tổ là mức xưởng thực sự điều hành. Toàn cảnh xưởng ƯU TIÊN chỉ
-- tiêu thật; (ngày,tổ,công đoạn) không có dòng → rơi về số SUY từ lộ trình.
-- RLS: enable, no policies (anon chặn, secret-key server bypass).
-- Idempotent: create if not exists / drop trigger if exists.

create table if not exists production_daily_targets (
  id uuid primary key default gen_random_uuid(),
  target_date date not null,
  team_department_id uuid not null references departments(id) on delete cascade,
  stage text not null,
  qty numeric(14, 2) not null check (qty >= 0),
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_date, team_department_id, stage)
);

create index if not exists production_daily_targets_date_idx
  on production_daily_targets (target_date);

drop trigger if exists set_updated_at on production_daily_targets;
create trigger set_updated_at
  before update on production_daily_targets
  for each row execute function public.set_updated_at();

alter table production_daily_targets enable row level security;
