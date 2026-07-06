-- Warehouse: material master (danh mục vật tư) — FR-WMS-01.
--
-- Phân hệ Kho đầu tiên. Bảng prefix `warehouse_` để không đụng bảng phòng khác.
-- RLS ENABLED, NO policies: anon/publishable key bị chặn hoàn toàn; server dùng
-- SUPABASE_SECRET_KEY bỏ qua RLS. Mọi truy cập qua API route, phân quyền ở app.
--
-- Apply: dán vào SQL editor, hoặc `npx supabase db push`. Sau đó "sync types".

create table if not exists public.warehouse_materials (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,                       -- mã VT (tự sinh/nhập tay)
  name           text not null check (char_length(name) between 1 and 200),
  unit           text not null default 'cái',                -- ĐVT
  group_name     text,                                       -- nhóm vật tư
  min_stock      numeric(14, 2) not null default 0 check (min_stock >= 0),  -- tồn tối thiểu
  shelf_location text,                                       -- vị trí kệ (A/B/C…)
  note           text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists warehouse_materials_group_idx
  on public.warehouse_materials (group_name) where is_active;
create index if not exists warehouse_materials_name_idx
  on public.warehouse_materials (lower(name));

drop trigger if exists trg_warehouse_materials_updated_at on public.warehouse_materials;
create trigger trg_warehouse_materials_updated_at
  before update on public.warehouse_materials
  for each row execute function public.set_updated_at();

alter table public.warehouse_materials enable row level security;
