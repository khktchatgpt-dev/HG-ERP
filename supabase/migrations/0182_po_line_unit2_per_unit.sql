-- 0182: HỆ SỐ QUY ĐỔI GIÁ trên dòng đơn đặt — đường "giá theo đơn vị khác"
-- TỔNG QUÁT cho các mẫu chưa có công thức riêng (sơn lít/thùng, hoá chất
-- kg/can, phụ kiện m/cuộn…). Nhôm/inox/bao bì/kính/gỗ/xốp đã có đường riêng
-- (kg/m, kg/đv, m², m³) — không đụng.
--
--   unit2_per_unit = bao nhiêu ĐƠN-VỊ-GIÁ trong MỘT ĐVT đặt (17,5 lít/thùng).
--   Nhãn đơn vị giá ghi vào cột `unit2` sẵn có; SL tính giá server dẫn xuất
--   vào `qty2` như các mẫu kim loại (deriveLine, không tin số client).
--
-- Chụp TRÊN DÒNG (như pack_size 0128) chứ không đọc sống từ danh mục
-- (warehouse_materials.unit2_factor): sửa danh mục sau này không được làm đổi
-- tiền của đơn đã lập.
--
-- RLS: bảng supply_purchase_order_lines đã enable RLS không policy từ 0116
-- (anon bị chặn, secret key bypass) — thêm cột không đổi tư thế đó.
-- Idempotent: chạy lại an toàn.

alter table public.supply_purchase_order_lines
  add column if not exists unit2_per_unit numeric;

comment on column public.supply_purchase_order_lines.unit2_per_unit is
  'Hệ số quy đổi giá: 1 ĐVT đặt = ? đơn-vị-giá (nhãn ở unit2). Chỉ mẫu không có công thức riêng; NULL = tính SL × giá.';
