-- 0056_material_spec.sql
-- QUY CÁCH vật tư (ItemMaster Nhóm 1 — Định danh): kích thước/thông số dùng chung
-- cho mọi loại, vd "25×25×1.2mm (cây 6m)", "dày 18mm", "1220×2440". Là trường của
-- vật tư → form đặt hàng TỰ ĐIỀN vào dòng đơn khi chọn vật tư (dòng vẫn sửa được).
--
-- Ghi chú: cột `spec` có trong file 0043 (chưa apply lên DB thật) — thêm ở đây với
-- add-if-not-exists, định nghĩa khớp 0043 nên tương thích nếu 0043 apply sau.
--
-- RLS: warehouse_materials đã enable từ 0009 — chỉ ALTER. Idempotent. Sau apply → SYNC TYPES.

alter table public.warehouse_materials
  add column if not exists spec text;
