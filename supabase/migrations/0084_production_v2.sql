-- 0084_production_v2.sql — THIẾT KẾ LẠI khu Sản xuất theo VAI (đập cũ, xây mới).
--
-- Bối cảnh (user chốt 07/2026): khu SX cũ có HAI nguồn sự thật về tiến độ
-- (production_progress start/done vs production_output_entries số lượng) không
-- ràng buộc nhau — tổ bấm "xong công đoạn" khi sổ mới ghi 30/100. Thiết kế lại
-- từ quy trình thật: Kế hoạch lên lộ trình + giao tổ + hạn → Thống kê định hình
-- chi tiết (từ BOM Kỹ thuật) + nhập sổ tập trung → Tổ trưởng đối chiếu + xác
-- nhận xong công đoạn (service CHẶN khi số chưa đủ) → complete → giao hàng.
--
-- Dữ liệu SX đang THỬ NGHIỆM (user chốt) → DROP các bảng thực thi cũ, không
-- migrate. Giữ production_orders (header LSX — giáp ranh Sales/exec/kho/PO
-- đang FK vào) + production_order_line_specs (spec in LSX, phía Sales phát).
--
-- Mô hình mới:
--   production_jobs        ★ trục chính: 1 dòng = LSX × dòng SP × công đoạn.
--                          Kế hoạch tạo (lộ trình seq + giao tổ + hạn); trạng
--                          thái todo/doing/done — nguồn TRẠNG THÁI duy nhất.
--   production_components  bảng định hình: chi tiết/định mức per dòng SP —
--                          snapshot từ technical_bom_lines + thống kê sửa.
--   production_entries     sổ số liệu APPEND-ONLY (chi tiết × công đoạn × ngày
--                          × tổ) — nguồn SỐ duy nhất. Phế = số + lý do text tự
--                          do (bỏ danh mục mã lỗi — user chốt đơn giản hoá).
--   production_outsource_entries  gia công ngoài send/receive (tạo lại, FK mới).
--   production_day_locks   chốt sổ ngày theo tổ (giữ nghiệp vụ, bảng tạo lại).
--
-- Bỏ hẳn: production_incidents + production_defect_codes (sự cố báo ngoài hệ —
-- user chốt), production_order_routes (lộ trình giờ nằm trong jobs),
-- production_progress (trạng thái giờ nằm trong jobs), production_orders.
-- current_stage (1 con trỏ vô nghĩa khi nhiều công đoạn song song — view
-- v_order_tracking chuyển sang đếm jobs_done/jobs_total).
--
-- RLS: mọi bảng mới ENABLED, NO policies (anon bị chặn, secret key bypass —
-- chuẩn dự án). View giữ security_invoker = on. Idempotent: drop if exists +
-- create if not exists. Apply: `npx supabase db push` / SQL editor. Sau đó
-- "sync types" (bắt buộc — bảng đổi nhiều).

-- ── 1. Drop bảng thực thi cũ (thứ tự: con trước, cha sau) ────────────────────

drop table if exists public.production_outsource_entries;
drop table if exists public.production_output_entries;
drop table if exists public.production_order_components;
drop table if exists public.production_order_routes;
drop table if exists public.production_progress;
drop table if exists public.production_incidents;
drop table if exists public.production_defect_codes;
drop table if exists public.production_day_locks;

-- ── 2. production_orders: + priority, − current_stage ────────────────────────

alter table public.production_orders
  add column if not exists priority int not null default 0;

-- View đang phụ thuộc current_stage → dựng lại view TRƯỚC (đổi bộ cột nên phải
-- drop + create, không or-replace được), rồi mới drop cột.
drop view if exists public.v_order_tracking;

-- ── 3. Bảng mới ──────────────────────────────────────────────────────────────

-- 3.1 production_jobs — trục chính: LSX × dòng SP × công đoạn.
-- stage = code catalog_items type 'production_stage' (không FK cứng — quy ước
-- chung §3 db-design-erp.md, service validate). seq = thứ tự trên lộ trình của
-- dòng SP. Cascade theo dòng SP: sửa đơn thay dòng → jobs dòng đó mất theo,
-- Kế hoạch lên lại (notification order.changed_after_lsx đã cảnh báo).
create table if not exists public.production_jobs (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  order_line_id       uuid not null
                        references public.sales_order_lines(id) on delete cascade,
  stage               text not null,
  seq                 int not null default 0,
  team_department_id  uuid references public.departments(id) on delete set null,
  planned_start       date,
  planned_end         date,
  status              text not null default 'todo'
                        check (status in ('todo', 'doing', 'done')),
  done_by             uuid references public.users(id) on delete set null,
  done_at             timestamptz,
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (production_order_id, order_line_id, stage)
);

create index if not exists production_jobs_lsx_idx
  on public.production_jobs (production_order_id, order_line_id, seq);
create index if not exists production_jobs_team_idx
  on public.production_jobs (team_department_id, status);

drop trigger if exists trg_production_jobs_updated_at on public.production_jobs;
create trigger trg_production_jobs_updated_at
  before update on public.production_jobs
  for each row execute function public.set_updated_at();

alter table public.production_jobs enable row level security;

-- 3.2 production_components — bảng định hình chi tiết (Thống kê tạo/sửa).
-- Snapshot per LSX: nháp từ technical_bom_lines rồi sửa — sửa BOM sau KHÔNG
-- đổi lệnh đang chạy. Đại lượng dẫn xuất (tổng cần, kg, số cây) KHÔNG lưu cứng
-- — tính ở service (src/lib/component-needs.ts). final_stage = công đoạn cuối
-- CỦA CHI TIẾT (không qua sơn thì cuối là nguội); null = cuối lộ trình dòng SP.
create table if not exists public.production_components (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  order_line_id       uuid not null
                        references public.sales_order_lines(id) on delete cascade,
  cluster             text,                                   -- cụm: "CỤM TỰA"
  name                text not null,                          -- chi tiết: "TAY+TỰA"
  material_id         uuid references public.warehouse_materials(id) on delete restrict,
  material_type       text,                                   -- TRÒN/ĐẶC/HỘP…
  spec_thickness_mm   numeric(10, 2) check (spec_thickness_mm > 0),
  spec_width_mm       numeric(10, 2) check (spec_width_mm > 0),
  spec_length_mm      numeric(10, 2) check (spec_length_mm > 0),
  qty_per_unit        numeric(14, 4) not null check (qty_per_unit > 0), -- CT/SP
  dm_kg               numeric(14, 4) check (dm_kg >= 0),      -- kg vật tư / 1 chi tiết
  pcs_per_bar         numeric(14, 4) check (pcs_per_bar > 0), -- số chi tiết / 1 cây
  final_stage         text,
  sort_order          int not null default 0,
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists production_components_lsx_idx
  on public.production_components (production_order_id);
create index if not exists production_components_line_idx
  on public.production_components (order_line_id);

drop trigger if exists trg_production_components_updated_at
  on public.production_components;
create trigger trg_production_components_updated_at
  before update on public.production_components
  for each row execute function public.set_updated_at();

alter table public.production_components enable row level security;

-- 3.3 production_entries — sổ số liệu APPEND-ONLY (Thống kê nhập tập trung).
-- Ghi nhầm → xoá bản ghi rồi nhập lại, không sửa đè. Tổng hợp (%HT, đồng bộ)
-- KHÔNG lưu cứng — tính ở service (src/lib/production-summary.ts).
create table if not exists public.production_entries (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  component_id        uuid not null
                        references public.production_components(id) on delete cascade,
  stage               text not null,
  team_department_id  uuid references public.departments(id) on delete set null,
  entry_date          date not null,
  qty                 numeric(14, 2) not null check (qty > 0),
  kg                  numeric(14, 4) check (kg >= 0),
  defect_qty          numeric(14, 2) not null default 0 check (defect_qty >= 0),
  defect_reason       text,                                   -- lý do text tự do
  machine_note        text,                                   -- máy cắt / loại hàn / màu sơn
  note                text,
  created_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists production_entries_lsx_idx
  on public.production_entries (production_order_id, entry_date desc);
create index if not exists production_entries_component_idx
  on public.production_entries (component_id, stage);
create index if not exists production_entries_date_idx
  on public.production_entries (entry_date, team_department_id);

alter table public.production_entries enable row level security;

-- 3.4 production_outsource_entries — gia công ngoài (giao/nhận per chi tiết).
create table if not exists public.production_outsource_entries (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  component_id        uuid not null
                        references public.production_components(id) on delete cascade,
  supplier_id         uuid not null
                        references public.supply_suppliers(id) on delete restrict,
  direction           text not null check (direction in ('send', 'receive')),
  entry_date          date not null,
  qty                 numeric(14, 2) not null check (qty > 0),
  kg                  numeric(14, 4) check (kg >= 0),
  defect_qty          numeric(14, 2) not null default 0 check (defect_qty >= 0),
  note                text,
  created_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists production_outsource_entries_lsx_idx
  on public.production_outsource_entries (production_order_id, entry_date desc);
create index if not exists production_outsource_entries_component_idx
  on public.production_outsource_entries (component_id, supplier_id);

alter table public.production_outsource_entries enable row level security;

-- 3.5 production_day_locks — chốt sổ cuối ngày theo tổ (Thống kê chốt, QL mở).
create table if not exists public.production_day_locks (
  id                 uuid primary key default gen_random_uuid(),
  team_department_id uuid not null
                       references public.departments(id) on delete cascade,
  entry_date         date not null,
  locked_by          uuid references public.users(id) on delete set null,
  locked_at          timestamptz not null default now(),
  unique (team_department_id, entry_date)
);

alter table public.production_day_locks enable row level security;

-- ── 4. Dựng lại v_order_tracking (bỏ current_stage → đếm jobs) ───────────────
-- Giữ nguyên các cột 0071 (lớp thương mại), thay current_stage bằng
-- jobs_total/jobs_done — tiến độ nhìn theo số công đoạn đã xong.

create view public.v_order_tracking with (security_invoker = on) as
select
  o.id,
  o.code,
  o.customer_id,
  c.name           as customer_name,
  o.customer_po_no,
  o.status,
  o.currency,
  o.due_date,
  q.code           as quote_code,
  po.id            as production_order_id,
  po.code          as lsx_code,
  po.status        as lsx_status,
  po.priority      as lsx_priority,
  po.ship_date,
  (select count(*)
     from public.production_jobs j
    where j.production_order_id = po.id)                      as jobs_total,
  (select count(*)
     from public.production_jobs j
    where j.production_order_id = po.id
      and j.status = 'done')                                  as jobs_done,
  (select count(*)
     from public.sales_order_lines ol
     join public.technical_products p on p.id = ol.product_id
    where ol.order_id = o.id and p.bom_status <> 'done')      as lines_bom_pending,
  (select count(*)
     from public.supply_purchase_orders spo
    where spo.production_order_id = po.id
      and spo.status not in ('received', 'cancelled'))        as pos_open,
  o.deposit_percent,
  o.payment_method,
  (select coalesce(sum(ol.qty * ol.unit_price), 0)
     from public.sales_order_lines ol
    where ol.order_id = o.id)                                 as order_value,
  (select count(*)
     from public.sales_order_lines ol
    where ol.order_id = o.id)                                 as line_count,
  o.created_at,
  o.updated_at
from public.sales_orders o
join public.sales_customers c on c.id = o.customer_id
left join public.sales_quotes q on q.id = o.quote_id
left join public.production_orders po on po.sales_order_id = o.id;

-- Cột cũ hết chỗ phụ thuộc → drop.
alter table public.production_orders
  drop column if exists current_stage;
