-- BÙ SÁU MIGRATION ĐÃ CHẠY THẲNG TRÊN DB THẬT MÀ REPO KHÔNG CÓ FILE.
--
-- Ngày 31/07/2026 một phiên làm việc ở máy khác apply sáu migration qua SQL
-- editor rồi không đẩy file lên repo (nhánh `feat/po-templates` chỉ mang theo
-- 0106 + 0107). Hệ quả: dựng lại DB từ `supabase/migrations` sẽ THIẾU cột, và
-- `database.types.ts` sinh ra từ DB thật thì có cột mà không ai truy được nguồn.
--
-- Đối chiếu ngày 01/08/2026 với `supabase_migrations.schema_migrations`, sáu
-- migration đó là (giữ nguyên tên gốc để tra ngược):
--   20260731013806 po_line_weight_basis_additive
--   20260731013819 po_line_qty_basis_check_and_view
--   20260731013833 drop_dead_cuts_per_bar
--   20260731024602 material_bar_specs
--   20260731031404 po_line_area_volume
--   20260731054756 po_missing_doc_fields
--
-- File này gộp cả sáu, chép đúng câu lệnh đã chạy. TOÀN BỘ idempotent nên chạy
-- trên DB hiện tại là no-op; giá trị nằm ở chỗ DB mới dựng ra giống hệt DB thật.
--
-- RLS: không tạo bảng mới. View `supply_po_line_status` giữ `security_invoker =
-- on` như bản đã chạy (kế thừa tư thế RLS của người gọi).

-- ── 1. Cơ sở tính SL/khối lượng cho dòng đơn (po_line_weight_basis_additive) ──
alter table public.supply_purchase_order_lines
  add column if not exists qty_basis       text not null default 'manual',
  add column if not exists weight_per_unit numeric(12, 4),
  add column if not exists for_product     text,
  add column if not exists qty_needed      numeric(14, 3),
  add column if not exists bar_length_m    numeric(12, 4),
  add column if not exists kg_per_m        numeric(12, 4);

alter table public.supply_purchase_orders
  add column if not exists supplier_doc_no  text,
  add column if not exists discount_amount  numeric(14, 2),
  add column if not exists delivery_place   text,
  add column if not exists weigh_on_receipt boolean not null default false;

-- Kho cân lại khi nhận: số kg thực nhận có thể lệch số kg trên đơn.
alter table public.warehouse_movements
  add column if not exists qty2_actual numeric(14, 3);

-- ── 2. Ràng buộc cơ sở tính + view theo dõi dòng đơn ─────────────────────────
-- (po_line_qty_basis_check_and_view, mở rộng sau ở po_line_area_volume)
update public.supply_purchase_order_lines
   set qty_basis = 'none'
 where qty2 is null
   and qty_basis = 'manual';

create index if not exists supply_po_supplier_doc_no_idx
  on public.supply_purchase_orders (supplier_id, supplier_doc_no);

create or replace view public.supply_po_line_status with (security_invoker = on) as
select
  l.id,
  l.po_id,
  l.material_id,
  l.qty_ordered,
  l.unit_price,
  l.spec,
  l.qty2,
  l.unit2,
  l.note,
  l.sort_order,
  coalesce(sum(case when mv.direction = 'in' then mv.qty + mv.qty_rejected
                    else -mv.qty end), 0)                       as qty_received,
  coalesce(sum(case when mv.direction = 'in' then mv.qty_rejected
                    else 0 end), 0)                             as qty_rejected,
  l.qty_ordered
    - coalesce(sum(case when mv.direction = 'in' then mv.qty + mv.qty_rejected
                        else -mv.qty end), 0)                   as qty_missing,
  coalesce(sum(case when mv.direction = 'in' then mv.qty2_actual
                    else -mv.qty2_actual end), 0)               as kg_received,
  max(mv.created_at) filter (where mv.direction = 'in')         as last_received_at
from public.supply_purchase_order_lines l
left join public.warehouse_movements mv
  on mv.po_line_id = l.id
group by l.id;

-- ── 3. Bỏ cột chết (drop_dead_cuts_per_bar) ─────────────────────────────────
alter table public.supply_purchase_order_lines
  drop column if exists cuts_per_bar;

-- ── 4. Barem cây/kg của vật tư (material_bar_specs) ─────────────────────────
-- `kg_per_m` là thứ mẫu đơn NHÔM nhân với dài cây × số cây ra tổng kg rồi × giá.
alter table public.warehouse_materials
  add column if not exists kg_per_m             numeric(12, 4),
  add column if not exists default_bar_length_m numeric(12, 4);

alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_kg_per_m_check;
alter table public.warehouse_materials
  add constraint warehouse_materials_kg_per_m_check
  check (kg_per_m is null or kg_per_m > 0);

alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_bar_length_check;
alter table public.warehouse_materials
  add constraint warehouse_materials_bar_length_check
  check (default_bar_length_m is null or (default_bar_length_m > 0 and default_bar_length_m <= 20));

-- ── 5. Kích thước cho hàng tính theo m²/m³ (po_line_area_volume) ────────────
alter table public.supply_purchase_order_lines
  add column if not exists dim_length_mm    numeric(12, 2),
  add column if not exists dim_width_mm     numeric(12, 2),
  add column if not exists dim_thickness_mm numeric(12, 2);

-- Ràng buộc cơ sở tính đặt SAU cùng vì 0109 §2 và §5 cùng sửa nó — bản cuối là
-- bản có thêm 'area' và 'volume'.
alter table public.supply_purchase_order_lines
  drop constraint if exists supply_po_lines_qty_basis_check;
alter table public.supply_purchase_order_lines
  add constraint supply_po_lines_qty_basis_check
  check (qty_basis in ('none', 'bar_m', 'per_unit', 'area', 'volume', 'manual'));

alter table public.supply_purchase_order_lines
  drop constraint if exists supply_po_lines_dims_check;
alter table public.supply_purchase_order_lines
  add constraint supply_po_lines_dims_check
  check (
    (dim_length_mm    is null or dim_length_mm    > 0) and
    (dim_width_mm     is null or dim_width_mm     > 0) and
    (dim_thickness_mm is null or dim_thickness_mm > 0)
  );

-- ── 6. Ô còn thiếu so với đơn giấy (po_missing_doc_fields) ──────────────────
alter table public.supply_suppliers
  add column if not exists contact_name  text,
  add column if not exists contact_phone text;

alter table public.supply_purchase_orders
  add column if not exists contract_no text;

alter table public.supply_purchase_order_lines
  add column if not exists color            text,
  add column if not exists for_product_code text;
