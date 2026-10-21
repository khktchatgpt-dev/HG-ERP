-- 0270 — MÁY MÓC & BẢO TRÌ (khu /may-moc). Mang từ bản demo "MOCA Tài sản",
-- viết lại cho HG (xưởng sắt – nhôm – sơn tĩnh điện – may). Bản vẽ được
-- duyệt 21/10/2026: https://claude.ai/artifact/5QCzMmGntjAYfddpkHYg8d
--
--   asset_groups      — nhóm máy / dụng cụ + lịch bảo trì mẫu (jsonb)
--   assets            — máy, thiết bị (kind machine) và dụng cụ cầm tay (tool)
--   asset_plans       — hạng mục bảo trì định kỳ của từng máy (giờ chạy / ngày / tháng)
--   asset_issues      — phiếu báo hỏng BH (moi → cho_duyet → dang_sua → xong · huy)
--   asset_work_orders — phiếu đã làm: PBD bảo dưỡng · PSC sửa chữa · PKD kiểm định
--   asset_movements   — chứng từ giao nhận: GT đưa vào dùng · CP giao · TH thu hồi ·
--                       DC điều chuyển · BM báo mất · TL thanh lý
--   asset_counters    — bộ đếm số (BH-0001, TS-HAN-001…) — asset_next_no() tăng nguyên tử
--   files.asset_issue_id — ảnh hiện trạng kèm phiếu báo hỏng
--
-- Người: thợ sửa, người phụ trách, người giữ dụng cụ = hồ sơ nhân viên
-- (hr_employees) — phần lớn thợ xưởng không có tài khoản. Người báo / người
-- bấm = tài khoản (users).
--
-- Quyền: assets.manage (Tổ Cơ điện), assets.approve (Ban Giám đốc), assets.tools
-- (giao / thu hồi dụng cụ — Kho, GĐ), assets.cost (xem chi phí — Kế toán, GĐ,
-- Cơ điện). Vai mới `maintenance` "Tổ Cơ điện", gán sẵn cho tài khoản thuộc
-- phòng "Tổ Cơ Điện". Xem mọi trang + báo hỏng: mọi người đăng nhập.
--
-- RLS: mọi bảng ENABLE, KHÔNG policy — khoá anon/publishable, khoá bí mật của
-- server bỏ qua. Mọi truy cập đi qua API + service.
--
-- CẨN THẬN: ràng buộc notifications_type_check chép từ DB THẬT ngày 21/10/2026
-- (đã gồm payroll_* của nhánh lương chạy thẳng lên DB, chưa có file trong repo).
-- Số 0270 chừa chỗ cho nhánh lương đang dùng 0253–0258.

-- ── Nhóm ───────────────────────────────────────────────────────────────────

create table if not exists public.asset_groups (
  id          text primary key,
  name        text not null,
  kind        text not null check (kind in ('machine', 'tool')),
  life_months int not null default 96,
  templates   jsonb not null default '[]'::jsonb,
  sort_order  int not null default 100,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- templates: [{task, every, unit: 'h'|'d'|'m', cost, inspection}]
insert into public.asset_groups (id, name, kind, life_months, sort_order, templates) values
  ('CAT', 'Máy cắt (cưa sắt, cưa nhôm, cắt ống, laser)', 'machine', 96, 10,
   '[{"task":"Mài / thay lưỡi cưa","every":40,"unit":"h","cost":250000},
     {"task":"Kiểm tra ray dẫn, bôi trơn","every":1,"unit":"m","cost":300000}]'),
  ('UON', 'Máy uốn – đột – dập', 'machine', 96, 20,
   '[{"task":"Kiểm tra dầu thuỷ lực, phớt","every":1,"unit":"m","cost":400000},
     {"task":"Thay dầu thuỷ lực","every":2000,"unit":"h","cost":3200000}]'),
  ('HAN', 'Máy hàn (MIG, TIG, hàn bấm)', 'machine', 96, 30,
   '[{"task":"Vệ sinh mỏ hàn, thay béc, kiểm tra dây mát","every":14,"unit":"d","cost":120000},
     {"task":"Kiểm tra bộ cấp dây, thổi bụi bo mạch","every":3,"unit":"m","cost":300000}]'),
  ('MAI', 'Máy mài – khoan – taro bàn', 'machine', 96, 40,
   '[{"task":"Kiểm tra trục, bạc đạn, bôi trơn","every":1,"unit":"m","cost":200000}]'),
  ('SON', 'Dây chuyền sơn tĩnh điện (buồng phun, lò sấy, băng treo)', 'machine', 120, 50,
   '[{"task":"Thay tấm lọc bụi sơn","every":1,"unit":"m","cost":1450000},
     {"task":"Hiệu chuẩn nhiệt độ lò sấy","every":3,"unit":"m","cost":1200000}]'),
  ('MAY', 'Máy may công nghiệp', 'machine', 96, 60,
   '[{"task":"Tra dầu, vệ sinh ổ chao","every":14,"unit":"d","cost":0},
     {"task":"Chỉnh chân vịt, răng cưa, kim","every":3,"unit":"m","cost":150000}]'),
  ('VAI', 'Máy cắt – trải vải', 'machine', 96, 70,
   '[{"task":"Mài dao cắt","every":7,"unit":"d","cost":50000}]'),
  ('KHI', 'Máy nén khí', 'machine', 96, 80,
   '[{"task":"Thay dầu, lọc dầu, lọc gió","every":2000,"unit":"h","cost":5500000},
     {"task":"Kiểm định bình chứa khí nén","every":36,"unit":"m","cost":2500000,"inspection":true}]'),
  ('HUT', 'Hệ thống hút bụi', 'machine', 96, 90,
   '[{"task":"Rũ bụi, thay túi lọc","every":3,"unit":"m","cost":6000000}]'),
  ('XNA', 'Xe nâng', 'machine', 96, 100,
   '[{"task":"Bảo dưỡng định kỳ: nhớt, phanh, xích nâng","every":250,"unit":"h","cost":1800000},
     {"task":"Kiểm định an toàn xe nâng","every":12,"unit":"m","cost":2200000,"inspection":true}]'),
  ('VTA', 'Phương tiện vận tải', 'machine', 96, 110,
   '[{"task":"Bảo dưỡng định kỳ","every":3,"unit":"m","cost":3500000},
     {"task":"Đăng kiểm phương tiện","every":12,"unit":"m","cost":1500000,"inspection":true}]'),
  ('DIE', 'Hệ thống điện – PCCC', 'machine', 180, 120,
   '[{"task":"Kiểm tra định kỳ hệ thống PCCC","every":12,"unit":"m","cost":3000000,"inspection":true}]'),
  ('DLG', 'Thiết bị đo lường – QC', 'machine', 60, 130,
   '[{"task":"Hiệu chuẩn thiết bị đo","every":12,"unit":"m","cost":1200000,"inspection":true}]'),
  ('VPH', 'Thiết bị văn phòng', 'machine', 60, 140, '[]'),
  ('DC', 'Dụng cụ điện cầm tay', 'tool', 24, 200, '[]'),
  ('SP', 'Súng phun sơn', 'tool', 18, 210, '[]'),
  ('MH', 'Kìm hàn – mỏ hàn', 'tool', 18, 220, '[]'),
  ('IT', 'CNTT – thiết bị nhỏ', 'tool', 36, 230, '[]')
on conflict (id) do nothing;

-- ── Máy / dụng cụ ──────────────────────────────────────────────────────────

create table if not exists public.assets (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  name               text not null,
  group_id           text not null references public.asset_groups(id) on delete restrict,
  kind               text not null check (kind in ('machine', 'tool')),
  model              text,
  serial             text,
  supplier           text,
  purchase_date      date,
  use_date           date,
  cost               numeric(16, 0) not null default 0,
  qty                int not null default 1 check (qty > 0),
  unit               text not null default 'chiếc',
  department_id      uuid references public.departments(id) on delete set null,
  resp_employee_id   uuid references public.hr_employees(id) on delete set null,
  holder_employee_id uuid references public.hr_employees(id) on delete set null,
  status             text not null default 'dang_dung'
                     check (status in ('dang_dung', 'chua_dung', 'hong', 'sua_chua', 'mat', 'thanh_ly')),
  hours_per_day      numeric(5, 1) not null default 0 check (hours_per_day >= 0),
  hours              numeric(12, 0) not null default 0 check (hours >= 0),
  hours_updated_on   date,
  disposed_on        date,
  note               text,
  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists assets_group_idx on public.assets (group_id);
create index if not exists assets_dept_idx on public.assets (department_id);
create index if not exists assets_holder_idx on public.assets (holder_employee_id) where holder_employee_id is not null;
drop trigger if exists assets_updated_at on public.assets;
create trigger assets_updated_at before update on public.assets
  for each row execute function public.set_updated_at();

-- ── Lịch bảo trì ───────────────────────────────────────────────────────────

create table if not exists public.asset_plans (
  id            uuid primary key default gen_random_uuid(),
  asset_id      uuid not null references public.assets(id) on delete cascade,
  task          text not null,
  every_n       int not null check (every_n > 0),
  unit          text not null check (unit in ('h', 'd', 'm')),
  cost          numeric(16, 0) not null default 0,
  is_inspection boolean not null default false,
  last_date     date not null,
  last_hours    numeric(12, 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists asset_plans_asset_idx on public.asset_plans (asset_id);
drop trigger if exists asset_plans_updated_at on public.asset_plans;
create trigger asset_plans_updated_at before update on public.asset_plans
  for each row execute function public.set_updated_at();

-- ── Báo hỏng ───────────────────────────────────────────────────────────────

create table if not exists public.asset_issues (
  id                uuid primary key default gen_random_uuid(),
  no                text not null unique,
  asset_id          uuid not null references public.assets(id) on delete restrict,
  reporter_user_id  uuid references public.users(id) on delete set null,
  reported_at       timestamptz not null default now(),
  description       text not null,
  priority          text not null check (priority in ('dung_may', 'van_chay')),
  status            text not null default 'moi'
                    check (status in ('moi', 'cho_duyet', 'dang_sua', 'xong', 'huy')),
  tech_employee_id  uuid references public.hr_employees(id) on delete set null,
  vendor            text,
  estimate          numeric(16, 0),
  started_on        date,
  -- Trạng thái máy TRƯỚC khi báo — huỷ phiếu thì trả máy về đúng chỗ cũ.
  prev_asset_status text,
  cancel_reason     text,
  file_ids          uuid[] not null default '{}',
  -- Vết: [{at, by (users.id), name, text}] — chỉ thêm, không sửa.
  log               jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists asset_issues_asset_idx on public.asset_issues (asset_id);
create index if not exists asset_issues_open_idx on public.asset_issues (status) where status in ('moi', 'cho_duyet', 'dang_sua');
-- Một máy chỉ có MỘT phiếu đang mở.
create unique index if not exists asset_issues_one_open
  on public.asset_issues (asset_id) where status in ('moi', 'cho_duyet', 'dang_sua');
drop trigger if exists asset_issues_updated_at on public.asset_issues;
create trigger asset_issues_updated_at before update on public.asset_issues
  for each row execute function public.set_updated_at();

-- ── Phiếu đã làm ───────────────────────────────────────────────────────────

create table if not exists public.asset_work_orders (
  id               uuid primary key default gen_random_uuid(),
  no               text not null unique,
  kind             text not null check (kind in ('BD', 'SC', 'KD')),
  asset_id         uuid not null references public.assets(id) on delete restrict,
  plan_id          uuid references public.asset_plans(id) on delete set null,
  issue_id         uuid references public.asset_issues(id) on delete set null,
  title            text not null,
  done_on          date not null,
  tech_employee_id uuid references public.hr_employees(id) on delete set null,
  vendor           text,
  -- [{name, qty, price}]
  parts            jsonb not null default '[]'::jsonb,
  labor            numeric(16, 0) not null default 0,
  cost             numeric(16, 0) not null default 0,
  downtime_hours   numeric(8, 1) not null default 0 check (downtime_hours >= 0),
  hours_reading    numeric(12, 0),
  note             text,
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists asset_work_orders_asset_idx on public.asset_work_orders (asset_id, done_on desc);
create index if not exists asset_work_orders_done_idx on public.asset_work_orders (done_on);

alter table public.asset_issues
  add column if not exists work_order_id uuid references public.asset_work_orders(id) on delete set null;

-- ── Giao nhận ──────────────────────────────────────────────────────────────

create table if not exists public.asset_movements (
  id                 uuid primary key default gen_random_uuid(),
  no                 text not null unique,
  type               text not null check (type in ('GT', 'CP', 'TH', 'DC', 'BM', 'TL')),
  moved_on           date not null,
  asset_ids          uuid[] not null,
  from_department_id uuid references public.departments(id) on delete set null,
  to_department_id   uuid references public.departments(id) on delete set null,
  from_employee_id   uuid references public.hr_employees(id) on delete set null,
  to_employee_id     uuid references public.hr_employees(id) on delete set null,
  note               text,
  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists asset_movements_assets_idx on public.asset_movements using gin (asset_ids);

-- ── Bộ đếm số ──────────────────────────────────────────────────────────────

create table if not exists public.asset_counters (
  key text primary key,
  n   int not null default 0
);

-- Tăng nguyên tử và trả số mới: asset_next_no('BH') → 1, 2, 3…
create or replace function public.asset_next_no(p_key text)
returns int
language sql
security invoker
set search_path = public
as $$
  insert into public.asset_counters (key, n) values (p_key, 1)
  on conflict (key) do update set n = public.asset_counters.n + 1
  returning n;
$$;

-- ── Ảnh báo hỏng ───────────────────────────────────────────────────────────

alter table public.files
  add column if not exists asset_issue_id uuid references public.asset_issues(id) on delete set null;
create index if not exists files_asset_issue_idx on public.files (asset_issue_id) where asset_issue_id is not null;

-- ── Hạn mức duyệt sửa chữa ─────────────────────────────────────────────────

insert into public.settings (key, value) values ('asset_approve_over', '10000000'::jsonb)
on conflict (key) do nothing;

-- ── Thông báo ──────────────────────────────────────────────────────────────

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low','wh_return','wh_doc_reversed',
                  'wh_stocktake_pending','wh_stocktake_approved','wh_stocktake_rejected',
                  'po_submitted','po_approved','po_rejected',
                  'po_withdrawn','po_reopened','po_reassigned','po_closed_short','po_late',
                  'po_adjusted',
                  'po_unapproved','po_question','po_answered','po_urgent_sent',
                  'po_issue',
                  'po_inbound_soon','po_inbound_moved',
                  'dnm_submitted','dnm_approved','dnm_rejected',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'lsx_orders_changed','lsx_revised',
                  'lsx_cancelled','lsx_header_changed',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved',
                  'feedback_new','feedback_reviewed','feedback_processed',
                  'feedback_commented','feedback_mentioned','feedback_confirmed',
                  'payroll_calculated','payroll_submitted','payroll_approved','payroll_returned',
                  'asset_issue_new','asset_issue_approval','asset_issue_decided','asset_issue_done'));

-- ── Quyền + vai ────────────────────────────────────────────────────────────

insert into public.permissions (key, label, domain, sort_order) values
  ('assets.manage',  'Máy móc: thêm máy, nhận việc sửa, ghi bảo trì (Tổ Cơ điện)', 'assets', 10),
  ('assets.approve', 'Máy móc: duyệt sửa chữa vượt hạn mức', 'assets', 20),
  ('assets.tools',   'Máy móc: giao / thu hồi dụng cụ cầm tay', 'assets', 30),
  ('assets.cost',    'Máy móc: xem chi phí bảo trì', 'assets', 40)
on conflict (key) do nothing;

insert into public.roles (key, label, description, is_system, is_active, sort_order)
values ('maintenance', 'Tổ Cơ điện', 'Nhận báo hỏng, sửa máy, ghi bảo trì, quản danh mục máy.', false, true, 22)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, v.pkey
from (values
  ('maintenance', 'assets.manage'), ('maintenance', 'assets.cost'),
  ('director', 'assets.approve'), ('director', 'assets.cost'), ('director', 'assets.tools'),
  ('warehouse_staff', 'assets.tools'),
  ('accounting_staff', 'assets.cost')
) as v(rkey, pkey)
join public.roles r on r.key = v.rkey
on conflict do nothing;

insert into public.user_roles (user_id, role_id, source)
select u.id, r.id, 'manual'
from public.users u
join public.departments d on d.id = u.department_id and d.name = 'Tổ Cơ Điện'
join public.roles r on r.key = 'maintenance'
where u.is_active and u.deleted_at is null
on conflict do nothing;

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.asset_groups      enable row level security;
alter table public.assets            enable row level security;
alter table public.asset_plans       enable row level security;
alter table public.asset_issues      enable row level security;
alter table public.asset_work_orders enable row level security;
alter table public.asset_movements   enable row level security;
alter table public.asset_counters    enable row level security;
