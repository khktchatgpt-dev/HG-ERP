-- Nhóm hàng NCC cung cấp (Vendor Master M4) — n–n supplier ↔ nhóm vật tư.
--
-- Nhóm vật tư dùng master sẵn có: catalog_items where type='material_group'.
-- Cho biết mỗi NCC cung cấp những nhóm hàng nào (lọc NCC theo nhóm khi tạo PO,
-- phân loại NCC theo nhóm hàng).
--
-- RLS ENABLE no policies. Idempotent.

create table if not exists public.supplier_material_groups (
  supplier_id uuid not null references public.supply_suppliers(id) on delete cascade,
  group_id    uuid not null references public.catalog_items(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (supplier_id, group_id)
);

create index if not exists supplier_material_groups_group_idx
  on public.supplier_material_groups (group_id);

alter table public.supplier_material_groups enable row level security;
