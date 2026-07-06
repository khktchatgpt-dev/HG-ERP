-- Kỹ thuật: sản phẩm theo khách + BOM per-SP (FR-ENG-01..05, BR-03).
--
-- CAVEAT: bảng technical_products đã tồn tại trên remote (tạo tay ngoài
-- migration, đã có trong database.types.ts). Khối create-if-not-exists dưới đây
-- khớp đúng cột hiện có để bộ migration tự tái tạo được từ DB trống; trên remote
-- nó no-op rồi các lệnh alter bổ sung cột mới.
--
-- Bổ sung theo docs/db-design-inputs-analysis.md (soi từ mẫu in thật):
--   - customer_id: thư viện SP THEO KHÁCH (null = mẫu chung) — FR-ENG-01
--   - bom_status: cờ BOM per-SP (none/drawing/done) — FR-ENG-05, BR-03
--   - customer_item_code: mã SP do KHÁCH đặt (sale contract in "Customer Item")
--   - description_en + packing jsonb: mô tả tiếng Anh + thông số đóng gói xuất
--     khẩu (dims L/W/H, carton cm/inch, qty_per_carton, loading_40hc) để in báo giá
--   - unit: ĐVT bán (PCS/SET/cái…) — code catalog_items, không FK cứng
-- BOM: technical_bom_lines — mã vật tư BOM = mã danh mục kho (đặc tả 4.2).
-- GĐ1 mỗi SP giữ 1 BOM hiện hành; phiên bản quản qua file Excel (module files).
--
-- RLS: ENABLED, NO policies (anon bị chặn, server secret key bypass).
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

create table if not exists public.technical_products (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  category    text,
  bom_url     text,
  drawing_url text,
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.technical_products
  add column if not exists customer_id uuid
    references public.sales_customers(id) on delete set null;
alter table public.technical_products
  add column if not exists bom_status text not null default 'none'
    check (bom_status in ('none', 'drawing', 'done'));
alter table public.technical_products
  add column if not exists customer_item_code text;
alter table public.technical_products
  add column if not exists description_en text;
alter table public.technical_products
  add column if not exists packing jsonb not null default '{}'::jsonb;
alter table public.technical_products
  add column if not exists unit text not null default 'cai';

create index if not exists technical_products_customer_idx
  on public.technical_products (customer_id) where is_active;
create index if not exists technical_products_item_code_idx
  on public.technical_products (lower(customer_item_code))
  where customer_item_code is not null;
create index if not exists technical_products_name_idx
  on public.technical_products (lower(name));

drop trigger if exists trg_technical_products_updated_at on public.technical_products;
create trigger trg_technical_products_updated_at
  before update on public.technical_products
  for each row execute function public.set_updated_at();

alter table public.technical_products enable row level security;

-- BOM hiện hành: định mức vật tư / 1 sản phẩm ---------------------------------

create table if not exists public.technical_bom_lines (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.technical_products(id) on delete cascade,
  material_id  uuid not null references public.warehouse_materials(id) on delete restrict,
  qty_per_unit numeric(14, 4) not null check (qty_per_unit > 0),
  note         text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (product_id, material_id)
);

create index if not exists technical_bom_lines_product_idx
  on public.technical_bom_lines (product_id);
create index if not exists technical_bom_lines_material_idx
  on public.technical_bom_lines (material_id);

drop trigger if exists trg_technical_bom_lines_updated_at on public.technical_bom_lines;
create trigger trg_technical_bom_lines_updated_at
  before update on public.technical_bom_lines
  for each row execute function public.set_updated_at();

alter table public.technical_bom_lines enable row level security;
