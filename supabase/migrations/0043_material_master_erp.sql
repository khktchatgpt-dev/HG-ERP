-- Item master chuẩn ERP (2/4): mở rộng `warehouse_materials` — docs/thiet-ke-item-master-erp.md §4.
--
-- Nâng item master tối giản (0009) lên chuẩn ERP: phân loại (item_type +
-- category), quy cách vật lý (kích thước/khối lượng + attributes jsonb cho spec
-- riêng loại), giá vốn tham khảo, điểm đặt hàng, nguồn hàng, thuế, audit.
-- TẤT CẢ cột thêm đều nullable / có default → KHÔNG phá dữ liệu & service cũ.
-- `base_unit` backfill = `unit` hiện tại (đơn vị tồn kho chuẩn cho quy đổi 0044).
-- `avg_cost` KHÔNG lưu ở đây — FIFO giữ giá vốn ở lớp giá (0045).
--
-- RLS: warehouse_materials đã enable từ 0009 — chỉ ALTER, không đổi posture.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó SYNC TYPES (đổi cột).

-- Phân loại -----------------------------------------------------------------------
alter table public.warehouse_materials
  add column if not exists item_type text not null default 'raw_material';
alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_item_type_check;
alter table public.warehouse_materials
  add constraint warehouse_materials_item_type_check
  check (item_type in ('raw_material', 'semi_finished', 'consumable',
                       'packaging', 'finished_good'));

alter table public.warehouse_materials
  add column if not exists category_id uuid
    references public.item_categories(id) on delete set null;
alter table public.warehouse_materials
  add column if not exists spec text;                    -- quy cách mô tả

-- Đơn vị tồn kho chuẩn (nền quy đổi 0044) -----------------------------------------
alter table public.warehouse_materials
  add column if not exists base_unit text;
update public.warehouse_materials set base_unit = unit where base_unit is null;

-- Quy cách vật lý (nullable — dùng cho ống/thanh/tôn/nẹp/kính) ---------------------
alter table public.warehouse_materials
  add column if not exists length_mm    numeric(12, 2) check (length_mm    is null or length_mm    >= 0);
alter table public.warehouse_materials
  add column if not exists width_mm     numeric(12, 2) check (width_mm     is null or width_mm     >= 0);
alter table public.warehouse_materials
  add column if not exists thickness_mm numeric(12, 2) check (thickness_mm is null or thickness_mm >= 0);
alter table public.warehouse_materials
  add column if not exists weight_kg    numeric(14, 3) check (weight_kg    is null or weight_kg    >= 0); -- KL 1 base_unit
alter table public.warehouse_materials
  add column if not exists color        text;
-- Spec riêng theo loại (brand, grade, surface, alloy…) — không EAV, không cột thưa.
alter table public.warehouse_materials
  add column if not exists attributes jsonb not null default '{}'::jsonb;

-- Giá vốn (tham khảo — giá vốn thực nằm ở lớp giá FIFO 0045) -----------------------
alter table public.warehouse_materials
  add column if not exists last_purchase_price numeric(14, 2)
    check (last_purchase_price is null or last_purchase_price >= 0);
alter table public.warehouse_materials
  add column if not exists currency text not null default 'VND';

-- Kế hoạch tồn (min_stock đã có từ 0009) ------------------------------------------
alter table public.warehouse_materials
  add column if not exists max_stock     numeric(14, 2) check (max_stock     is null or max_stock     >= 0);
alter table public.warehouse_materials
  add column if not exists reorder_point numeric(14, 2) check (reorder_point is null or reorder_point >= 0);
alter table public.warehouse_materials
  add column if not exists reorder_qty   numeric(14, 2) check (reorder_qty   is null or reorder_qty   >= 0);
alter table public.warehouse_materials
  add column if not exists lead_time_days int          check (lead_time_days is null or lead_time_days >= 0);

-- Nguồn hàng ----------------------------------------------------------------------
alter table public.warehouse_materials
  add column if not exists default_supplier_id uuid
    references public.supply_suppliers(id) on delete set null;
alter table public.warehouse_materials
  add column if not exists make_or_buy text not null default 'buy';
alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_make_or_buy_check;
alter table public.warehouse_materials
  add constraint warehouse_materials_make_or_buy_check
  check (make_or_buy in ('buy', 'make'));

-- Thuế / media / audit ------------------------------------------------------------
alter table public.warehouse_materials
  add column if not exists vat_rate numeric(5, 2) check (vat_rate is null or vat_rate between 0 and 100);
alter table public.warehouse_materials
  add column if not exists image_url text;
alter table public.warehouse_materials
  add column if not exists created_by uuid references public.users(id) on delete set null;
alter table public.warehouse_materials
  add column if not exists updated_by uuid references public.users(id) on delete set null;

create index if not exists warehouse_materials_category_idx
  on public.warehouse_materials (category_id) where is_active;
create index if not exists warehouse_materials_type_idx
  on public.warehouse_materials (item_type) where is_active;
