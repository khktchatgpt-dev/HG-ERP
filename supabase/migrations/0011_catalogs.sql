-- Danh mục dùng chung + kho + bộ đếm số chứng từ (FR-ADM-04, FR-WMS-10).
--
-- 1) catalog_items: danh mục ĐVT / nhóm vật tư / giai đoạn SX / loại hợp đồng.
--    Các bảng nghiệp vụ tham chiếu bằng CODE (text), KHÔNG FK cứng — sửa danh mục
--    không khoá dữ liệu cũ (trade-off đã chốt trong docs/db-design-erp.md §3).
-- 2) warehouses: tạo ngay từ GĐ1 (seed 1 kho MAIN, UI ẩn) để movements có chỗ gắn
--    warehouse_id trước khi dữ liệu dày lên.
-- 3) doc_counters + next_doc_code(kind): sinh mã chứng từ BG/DH/LSX/PO/PNK/PXK/DCK/KK
--    dạng KIND-YYYY-NNNN, an toàn concurrent (insert … on conflict … returning).
--
-- RLS: ENABLED, NO policies trên mọi bảng — anon/publishable key bị chặn hoàn
-- toàn; server dùng SUPABASE_SECRET_KEY bypass. Mọi truy cập qua API route.
--
-- Apply: `npx supabase db push` hoặc dán vào SQL editor. Sau đó "sync types".

-- 1) Danh mục dùng chung ------------------------------------------------------

create table if not exists public.catalog_items (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in
               ('unit', 'material_group', 'product_category',
                'production_stage', 'contract_type')),
  code       text not null,
  label      text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, code)
);

drop trigger if exists trg_catalog_items_updated_at on public.catalog_items;
create trigger trg_catalog_items_updated_at
  before update on public.catalog_items
  for each row execute function public.set_updated_at();

alter table public.catalog_items enable row level security;

-- Seed ĐVT (mẫu in dùng: cái/bộ/tấm/cây/kg/m/m²/PCS/SET…)
insert into public.catalog_items (type, code, label, sort_order) values
  ('unit', 'cai',   'Cái',   1),
  ('unit', 'bo',    'Bộ',    2),
  ('unit', 'chiec', 'Chiếc', 3),
  ('unit', 'tam',   'Tấm',   4),
  ('unit', 'cay',   'Cây',   5),
  ('unit', 'm',     'Mét',   6),
  ('unit', 'm2',    'M²',    7),
  ('unit', 'kg',    'Kg',    8),
  ('unit', 'lit',   'Lít',   9),
  ('unit', 'cuon',  'Cuộn', 10),
  ('unit', 'hop',   'Hộp',  11),
  ('unit', 'thung', 'Thùng',12),
  ('unit', 'pcs',   'PCS',  13),
  ('unit', 'set',   'SET',  14)
on conflict (type, code) do nothing;

-- Seed giai đoạn sản xuất (đặc tả 4.5: phôi → hàn → sơn → mài → hoàn thiện)
insert into public.catalog_items (type, code, label, sort_order) values
  ('production_stage', 'phoi',      'Phôi',        1),
  ('production_stage', 'han',       'Hàn',         2),
  ('production_stage', 'son',       'Sơn',         3),
  ('production_stage', 'mai',       'Mài',         4),
  ('production_stage', 'hoan_thien','Hoàn thiện',  5)
on conflict (type, code) do nothing;

-- Seed nhóm vật tư (theo các mẫu đơn đặt NCC thực tế: nhôm/kính/nhựa-dây…)
insert into public.catalog_items (type, code, label, sort_order) values
  ('material_group', 'nhom',    'Nhôm định hình',      1),
  ('material_group', 'kinh',    'Kính',                2),
  ('material_group', 'nhua_day','Nhựa & dây đan',      3),
  ('material_group', 'vai_nem', 'Vải & nệm',           4),
  ('material_group', 'go',      'Gỗ',                  5),
  ('material_group', 'oc_vit',  'Ốc vít & phụ kiện',   6),
  ('material_group', 'son',     'Sơn & hoá chất',      7),
  ('material_group', 'bao_bi',  'Bao bì đóng gói',     8)
on conflict (type, code) do nothing;

-- 2) Kho (FR-WMS-10 — hiện 1 kho, thiết kế mở rộng) ---------------------------

create table if not exists public.warehouses (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  address    text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_warehouses_updated_at on public.warehouses;
create trigger trg_warehouses_updated_at
  before update on public.warehouses
  for each row execute function public.set_updated_at();

alter table public.warehouses enable row level security;

insert into public.warehouses (code, name)
values ('MAIN', 'Kho chính')
on conflict (code) do nothing;

-- 3) Bộ đếm số chứng từ -------------------------------------------------------
-- Kinds dự kiến: BG (báo giá), DH (đơn hàng), LSX, PO (đặt vật tư),
-- PNK/PXK (nhập/xuất kho), DCK (điều chuyển), KK (kiểm kê).

create table if not exists public.doc_counters (
  kind    text not null,
  year    int  not null,
  last_no int  not null default 0,
  primary key (kind, year)
);

alter table public.doc_counters enable row level security;

create or replace function public.next_doc_code(p_kind text)
returns text
language sql
volatile
set search_path = ''
as $$
  insert into public.doc_counters as c (kind, year, last_no)
  values (p_kind, extract(year from now())::int, 1)
  on conflict (kind, year)
  do update set last_no = c.last_no + 1
  returning c.kind || '-' || c.year::text || '-' || lpad(c.last_no::text, 4, '0');
$$;
