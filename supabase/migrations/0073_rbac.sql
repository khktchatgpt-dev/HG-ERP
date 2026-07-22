-- 0073_rbac.sql
-- RBAC data-hoá (Phase 0 — nền tảng, KHÔNG rewire code).
--
-- Đưa "vai + quyền" thành DỮ LIỆU thay cho suy diễn từ role cứng + tên phòng
-- hardcode rải khắp service. 4 bảng:
--   permissions       — "từ vựng" quyền (key bất biến, vd 'production.lsx.approve').
--   roles             — vai đặt tên = bó permission (admin/director/sales_staff…).
--   role_permissions  — role ↔ permission (IT sửa được, trừ role hệ thống).
--   user_roles        — user ↔ role, NHIỀU-NHIỀU (1 người kiêm nhiều vai).
--
-- BACKFILL (cuối file): seed user_roles + role_permissions sao cho quyền hiệu
-- lực Y HỆT guard hiện tại → bật RBAC không đổi hành vi. Đây là LẦN CUỐI CÙNG
-- tên phòng được hardcode (trong SQL seed); code sẽ đọc từ bảng, không so tên.
--
-- LƯU Ý: Phase 0 admin vẫn = cột users.role (code bypass). Role RBAC 'admin'
-- được seed đủ mọi permission để (a) ma trận /admin/permissions hiển thị đúng,
-- (b) nếu sau này IT gán role 'admin' cho ai thì có đủ quyền.
--
-- RLS: ENABLE, no policies — anon bị chặn, server secret key bypass (chuẩn dự án).
-- Idempotent. Apply: `npx supabase db push` / SQL editor. Sau đó "sync types".

-- ── Bảng ───────────────────────────────────────────────────────────────────

create table if not exists public.permissions (
  key         text primary key,          -- vd 'production.lsx.approve' (bất biến)
  label       text not null,
  domain      text not null,             -- nhóm hiển thị: production/sales/supply/…
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,      -- vd 'director' (bất biến)
  label       text not null,
  description text,
  is_system   boolean not null default false,  -- true = IT không được xoá
  is_active   boolean not null default true,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id        uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create table if not exists public.user_roles (
  user_id     uuid not null references public.users(id) on delete cascade,
  role_id     uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists role_permissions_role_idx on public.role_permissions (role_id);
create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role_id);

drop trigger if exists trg_roles_updated_at on public.roles;
create trigger trg_roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

alter table public.permissions      enable row level security;
alter table public.roles            enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles       enable row level security;

-- ── Seed: PERMISSIONS (từ vựng, phủ mọi guard is*Staff / can*) ──────────────

insert into public.permissions (key, label, domain, sort_order) values
  -- production
  ('production.member',           'Là nhân sự Sản xuất',            'production', 10),
  ('production.lsx.issue',        'Phát lệnh sản xuất (LSX)',       'production', 11),
  ('production.lsx.approve',      'Duyệt / từ chối LSX',            'production', 12),
  ('production.progress.track',   'Cập nhật tiến độ sản xuất',      'production', 13),
  ('production.components.edit',  'Định hình: bảng chi tiết + lộ trình', 'production', 14),
  ('production.output.record',    'Nhập sổ sản lượng',              'production', 15),
  ('production.outsource.record', 'Nhập gia công ngoài',            'production', 16),
  ('production.daylock.lock',     'Chốt sổ ngày',                   'production', 17),
  ('production.daylock.unlock',   'Mở lại sổ ngày',                 'production', 18),
  ('production.incident.report',  'Báo sự cố sản xuất',             'production', 19),
  ('production.incident.close',   'Đóng sự cố sản xuất',            'production', 20),
  ('production.team.manage',      'Quản lý việc của tổ',            'production', 21),
  ('planner.member',              'Là nhân sự Kế hoạch sản xuất',   'production', 22),
  -- sales
  ('sales.member',                'Là nhân sự Bán hàng',            'sales', 30),
  ('sales.customer.edit_any',     'Sửa mọi khách hàng',             'sales', 31),
  ('sales.order.confirm_delivery','Xác nhận giao đơn',              'sales', 32),
  -- supply
  ('supply.member',               'Là nhân sự Cung ứng',            'supply', 40),
  ('supply.po.approve',           'Duyệt đơn mua (PO)',             'supply', 41),
  -- warehouse
  ('warehouse.member',            'Là nhân sự Kho',                 'warehouse', 50),
  ('warehouse.edit',              'Sửa kho / nhập-xuất tồn',        'warehouse', 51),
  ('warehouse.material.create',   'Tạo vật tư mới',                 'warehouse', 52),
  -- technical
  ('technical.member',            'Là nhân sự Kỹ thuật',            'technical', 60),
  ('technical.edit',              'Sửa dữ liệu kỹ thuật',           'technical', 61),
  ('technical.bom.edit',          'Sửa BOM sản phẩm',               'technical', 62),
  -- hr
  ('hr.member',                   'Là nhân sự Hành chính - Nhân sự','hr', 70),
  ('hr.leave.decide',             'Duyệt đơn nghỉ phép',            'hr', 71),
  -- accounting
  ('accounting.member',           'Là nhân sự Tài chính - Kế toán', 'accounting', 80),
  -- exec
  ('exec.tower.view',             'Xem tháp điều hành',             'exec', 90),
  ('exec.approvals.view',         'Xem lịch sử phê duyệt',          'exec', 91),
  -- team / core
  ('team.dashboard.view',         'Xem bảng điều hành đội nhóm',    'team', 95),
  -- system (admin-only; để hiển thị ma trận cho đủ)
  ('system.users.manage',         'Quản trị người dùng',            'system', 100),
  ('system.departments.manage',   'Quản trị phòng ban',             'system', 101),
  ('system.catalogs.manage',      'Quản trị danh mục dùng chung',   'system', 102),
  ('system.settings.manage',      'Quản trị cấu hình hệ thống',     'system', 103),
  ('system.rbac.manage',          'Quản trị phân quyền',            'system', 104)
on conflict (key) do nothing;

-- ── Seed: ROLES ────────────────────────────────────────────────────────────

insert into public.roles (key, label, description, is_system, sort_order) values
  ('admin',           'Quản trị hệ thống (IT)', 'Toàn quyền hệ thống.', true, 1),
  ('director',        'Ban Giám đốc / Quản lý', 'Duyệt phê, điều phối, xem chéo.', true, 2),
  ('head',            'Trưởng phòng',           'Xem bảng điều hành đội nhóm.', true, 3),
  ('sales_staff',     'NV Bán hàng',            'Tác nghiệp bán hàng.', true, 10),
  ('planner',         'NV Kế hoạch sản xuất',   'Định hình sản xuất.', true, 11),
  ('supply_staff',    'NV Cung ứng - Mua hàng', 'Tác nghiệp cung ứng/PO.', true, 12),
  ('production_staff','NV Sản xuất',            'Tác nghiệp xưởng.', true, 13),
  ('warehouse_staff', 'NV Kho',                 'Tác nghiệp kho.', true, 14),
  ('technical_staff', 'NV Kỹ thuật',            'Tác nghiệp kỹ thuật.', true, 15),
  ('accounting_staff','NV Tài chính - Kế toán', 'Tác nghiệp kế toán.', true, 16),
  ('hr_staff',        'NV Hành chính - Nhân sự','Tác nghiệp HR.', true, 17),
  ('qc_staff',        'NV QC',                  'Tác nghiệp kiểm tra chất lượng.', true, 18)
on conflict (key) do nothing;

-- ── Seed: ROLE_PERMISSIONS (tái tạo chính xác từng guard hiện tại) ──────────

insert into public.role_permissions (role_id, permission_key)
select r.id, v.pkey
from (values
  -- director = nhánh "admin OR manager" của mọi guard
  ('director', 'production.lsx.approve'),
  ('director', 'production.progress.track'),
  ('director', 'production.components.edit'),
  ('director', 'production.daylock.lock'),
  ('director', 'production.daylock.unlock'),
  ('director', 'production.incident.close'),
  ('director', 'production.team.manage'),
  ('director', 'supply.po.approve'),
  ('director', 'warehouse.edit'),
  ('director', 'warehouse.material.create'),
  ('director', 'technical.edit'),
  ('director', 'hr.leave.decide'),
  ('director', 'exec.tower.view'),
  ('director', 'exec.approvals.view'),
  ('director', 'sales.customer.edit_any'),
  ('director', 'sales.order.confirm_delivery'),
  -- head
  ('head', 'team.dashboard.view'),
  -- sales_staff
  ('sales_staff', 'sales.member'),
  ('sales_staff', 'sales.customer.edit_any'),
  ('sales_staff', 'sales.order.confirm_delivery'),
  ('sales_staff', 'production.lsx.issue'),        -- canIssue = admin OR isSalesStaff
  ('sales_staff', 'technical.bom.edit'),          -- BOM: Kỹ Thuật OR Bán Hàng
  -- planner
  ('planner', 'planner.member'),                   -- isPlannerStaff
  ('planner', 'production.components.edit'),        -- canEditComponents (nhánh planner)
  -- supply_staff
  ('supply_staff', 'supply.member'),
  ('supply_staff', 'warehouse.material.create'),   -- Cung ứng tạo nhanh vật tư (07/2026)
  -- production_staff
  ('production_staff', 'production.member'),
  ('production_staff', 'production.progress.track'),
  ('production_staff', 'production.output.record'),
  ('production_staff', 'production.outsource.record'),
  ('production_staff', 'production.daylock.lock'),
  ('production_staff', 'production.incident.report'),
  ('production_staff', 'production.team.manage'),
  -- warehouse_staff
  ('warehouse_staff', 'warehouse.member'),
  ('warehouse_staff', 'warehouse.edit'),
  ('warehouse_staff', 'warehouse.material.create'),
  -- technical_staff
  ('technical_staff', 'technical.member'),
  ('technical_staff', 'technical.edit'),
  ('technical_staff', 'technical.bom.edit'),
  -- accounting_staff
  ('accounting_staff', 'accounting.member'),
  -- hr_staff
  ('hr_staff', 'hr.member')
) as v(rkey, pkey)
join public.roles r on r.key = v.rkey
on conflict do nothing;

-- admin = MỌI permission (auto phủ toàn bộ từ vựng hiện có)
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r cross join public.permissions p
where r.key = 'admin'
on conflict do nothing;

-- ── Backfill: USER_ROLES (từ users.role + department hiện tại) ──────────────
-- Chỉ user còn sống (deleted_at is null). assigned_by = null (hệ thống seed).

-- admin (theo cột role)
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u cross join public.roles r
where u.deleted_at is null and u.role = 'admin' and r.key = 'admin'
on conflict do nothing;

-- director (theo cột role = manager)
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u cross join public.roles r
where u.deleted_at is null and u.role = 'manager' and r.key = 'director'
on conflict do nothing;

-- head (trưởng phòng — head_user_id của bất kỳ phòng nào)
insert into public.user_roles (user_id, role_id)
select distinct d.head_user_id, r.id
from public.departments d cross join public.roles r
where d.head_user_id is not null and r.key = 'head'
on conflict do nothing;

-- Vai theo PHÒNG — bằng workspace_id (ổn định) cho các workspace 1-1:
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u
join public.departments d on d.id = u.department_id
join public.roles r on r.key = (case d.workspace_id
    when 'sales'      then 'sales_staff'
    when 'finance'    then 'accounting_staff'
    when 'warehouse'  then 'warehouse_staff'
    when 'technical'  then 'technical_staff'
    when 'production' then 'production_staff'
    when 'qc'         then 'qc_staff'
    when 'hr'         then 'hr_staff'
    else null end)
where u.deleted_at is null
on conflict do nothing;

-- Vai trong workspace 'planning' phải tách theo TÊN phòng (workspace_id không đủ):
--   'Kế Hoạch Sản Xuất-cung ứng' → planner + supply_staff (phòng gộp cũ)
--   'Kế Hoạch Sản Xuất'          → planner
--   'Cung Ứng - Mua Hàng'        → supply_staff
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u
join public.departments d on d.id = u.department_id
join public.roles r on r.key = 'planner'
where u.deleted_at is null
  and d.name in ('Kế Hoạch Sản Xuất-cung ứng', 'Kế Hoạch Sản Xuất')
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u
join public.departments d on d.id = u.department_id
join public.roles r on r.key = 'supply_staff'
where u.deleted_at is null
  and d.name in ('Kế Hoạch Sản Xuất-cung ứng', 'Cung Ứng - Mua Hàng')
on conflict do nothing;
