-- Cung ứng: thêm MẪU ĐƠN ĐẶT HÀNG "fabric" — vải / da / chỉ may, đặt theo MÉT.
--
-- Đơn thật (Tiêu Điểm Sáng, LSX 1/26-27): vải POLY CD 230GR, SL đơn hàng là số
-- SẢN PHẨM × Đm/sp (mét/SP) = mét cần đặt, giá 98.000đ/mét, GTGT 8%. Trước đây
-- nhóm "Vải - da - chỉ - phụ liệu may" gán mẫu phụ kiện nên không có cột mét nào
-- được chọn tên là vải. Meta/điều khoản/bộ cột nằm ở code (po-template.ts + po-fields.ts).
--
-- 1) Mở check constraint po_template (vật tư) và template (đơn) nhận 'fabric'.
--    Giữ nguyên toàn bộ giá trị đang có (kể cả 'outsourcing' của dữ liệu cũ).
-- 2) Không backfill vật tư: mẫu là giá trị khởi đầu của nhóm, Cung ứng đổi tay
--    trên màn Quản lý nhóm (xem sổ nhớ po-template-not-on-material).
--
-- RLS: không đổi (đây là cột text + check, không tạo bảng/view). Idempotent.
-- Apply xong KHÔNG cần sync types (text column).

alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_po_template_check;

alter table public.warehouse_materials
  add constraint warehouse_materials_po_template_check
  check (po_template is null
         or po_template in ('accessory', 'fabric', 'aluminium', 'metal_kg', 'carton',
                            'rattan', 'paint', 'chemical', 'foam',
                            'glass', 'wood', 'outsourcing', 'mro', 'label', 'simple'));

alter table public.supply_purchase_orders
  drop constraint if exists supply_purchase_orders_template_check;

alter table public.supply_purchase_orders
  add constraint supply_purchase_orders_template_check
  check (template in ('accessory', 'fabric', 'aluminium', 'metal_kg', 'carton',
                      'rattan', 'paint', 'chemical', 'foam',
                      'glass', 'wood', 'outsourcing', 'mro', 'label', 'simple'));
