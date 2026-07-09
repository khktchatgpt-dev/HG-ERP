-- Bảng giá chào NCC theo vật tư (đóng gap G-1 — FR-SUP-06 "quản lý NCC: bảng giá").
--
-- Mỗi bản ghi = giá chào của 1 NCC cho 1 vật tư, hiệu lực từ `valid_from`.
-- "Giá hiện hành" = bản ghi valid_from lớn nhất ≤ hôm nay per (NCC, vật tư) —
-- KHÔNG xoá lịch sử, đổi giá = thêm bản ghi mới. Giá giữ NGUYÊN TỆ (VND/USD…),
-- không quy đổi (nhất quán OI-02/OI-12). Giá theo ĐVT chính của vật tư (OI-10
-- ĐVT kép chưa chốt). Lịch sử giá MUA thật vẫn tra từ supply_purchase_order_lines.
--
-- RLS: ENABLED, NO policies — anon bị chặn, server secret-key bypass.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

create table if not exists public.supply_supplier_prices (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null
                references public.supply_suppliers(id) on delete cascade,
  material_id uuid not null
                references public.warehouse_materials(id) on delete restrict,
  price       numeric(18, 2) not null check (price >= 0),
  currency    char(3) not null default 'VND',
  valid_from  date not null default current_date,
  note        text,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (supplier_id, material_id, valid_from)
);

-- Màn so giá tra theo vật tư (mọi NCC đang chào giá gì).
create index if not exists supply_supplier_prices_material_idx
  on public.supply_supplier_prices (material_id, valid_from desc);
create index if not exists supply_supplier_prices_supplier_idx
  on public.supply_supplier_prices (supplier_id, material_id);

drop trigger if exists trg_supply_supplier_prices_updated_at on public.supply_supplier_prices;
create trigger trg_supply_supplier_prices_updated_at
  before update on public.supply_supplier_prices
  for each row execute function public.set_updated_at();

alter table public.supply_supplier_prices enable row level security;
