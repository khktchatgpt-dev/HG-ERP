-- 0053_material_dual_unit_pricing.sql
-- Giá vật tư theo ĐƠN VỊ KÉP (mua theo cây/tấm, giá theo kg/m² — mô hình SAP
-- Order Price Unit thu gọn, xem phân tích trong chat 07/2026):
--   warehouse_materials.price_unit  : đơn vị TÍNH GIÁ ('kg', 'm²'…). NULL = giá
--                                     theo ĐVT mua như cũ (nhóm A).
--   warehouse_materials.unit2_factor: hệ số quy đổi GỢI Ý (vd 5.4 kg/cây) —
--                                     chỉ để prefill, dòng PO sửa được vì sắt
--                                     cân thực tế lệch theo quy cách/lô.
--   supply_purchase_order_lines.price_basis: 'unit' (mặc định — SL đặt × giá)
--                                     | 'unit2' (qty2 × giá, vd tổng kg × đ/kg).
-- Cột mới nullable/default — KHÔNG backfill, dòng cũ giữ nguyên cách tính.
-- Không đổi RLS: hai bảng đã enable row level security không policy từ trước.
-- Idempotent: add column if not exists.

alter table warehouse_materials
  add column if not exists price_unit text,
  add column if not exists unit2_factor numeric(12, 4)
    check (unit2_factor is null or unit2_factor > 0);

alter table supply_purchase_order_lines
  add column if not exists price_basis text not null default 'unit'
    check (price_basis in ('unit', 'unit2'));
