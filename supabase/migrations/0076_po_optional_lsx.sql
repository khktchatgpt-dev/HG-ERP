-- 0076_po_optional_lsx.sql — PO ngoài LSX (định hướng lại Cung ứng, bước 1)
--
-- supply_purchase_orders.production_order_id: NOT NULL → NULL được.
--   - Gắn LSX  = "PO theo lệnh sản xuất" (như cũ — 1 LSX có nhiều PO).
--   - NULL     = "PO ngoài LSX": vật tư tiêu hao/dùng chung, mua bù tồn kho,
--     không thuộc lệnh sản xuất nào (nới BR-06 phần LSX; phần 1-NCC giữ nguyên).
-- Không đổi flow duyệt (BR-05), theo dõi về hàng theo dòng (BR-08).
-- View liên quan không cần sửa: v_order_tracking.pos_open & supply_po_line_status
-- đều lọc/join theo id — PO ngoài LSX đơn giản không xuất hiện trong đếm theo LSX.
--
-- RLS: không đổi (bảng đã enable RLS, no policies — anon bị chặn, secret key bypass).
-- Idempotent: DROP NOT NULL chạy lại vô hại.

alter table public.supply_purchase_orders
  alter column production_order_id drop not null;

comment on column public.supply_purchase_orders.production_order_id is
  'LSX của đơn (PO theo lệnh sản xuất). NULL = PO ngoài LSX — tiêu hao/dùng chung (0076).';
