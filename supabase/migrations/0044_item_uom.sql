-- Item master chuẩn ERP (3/4): đơn vị & quy đổi — docs/thiet-ke-item-master-erp.md §5.
--
-- Giải G1: một vật tư có NHIỀU đơn vị (mua theo kg/cây, tồn theo cây, BOM tiêu
-- hao theo mét). Mỗi dòng khai hệ số `to_base` quy về `base_unit` của vật tư
-- (0043) → mọi số lượng nhập/xuất quy về một đơn vị gốc khi ghi sổ cái, tồn kho
-- luôn nhất quán. `role` phân vai: stock (đơn vị tồn) / purchase / consume / alt.
-- Ví dụ ống Ø25 (base 'cây', cây 6m = 8.4kg): kg→0.119, mét→0.1667.
--
-- RLS: ENABLED, NO policies — anon bị chặn, secret key server bypass.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó SYNC TYPES (bảng mới).

create table if not exists public.item_uom (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.warehouse_materials(id) on delete cascade,
  unit        text not null,                              -- 'cây','kg','mét','thùng'…
  to_base     numeric(18, 6) not null check (to_base > 0),-- 1 unit = to_base × base_unit
  role        text not null default 'alt'
                check (role in ('stock', 'purchase', 'consume', 'alt')),
  created_at  timestamptz not null default now(),
  unique (material_id, unit)
);

create index if not exists item_uom_material_idx
  on public.item_uom (material_id);

alter table public.item_uom enable row level security;

-- Seed dòng 'stock' cho vật tư hiện có: base_unit tự quy đổi hệ số 1.
insert into public.item_uom (material_id, unit, to_base, role)
select id, base_unit, 1, 'stock'
from public.warehouse_materials
where base_unit is not null
on conflict (material_id, unit) do nothing;
