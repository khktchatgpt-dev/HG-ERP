-- 0055_material_conversion_profile.sql
-- LOẠI QUY ĐỔI (Profile A/B/C) + fields tự-điền lên đơn — tài liệu ItemMaster §2–§4.
-- Mỗi vật tư gán đúng 1 profile; form đặt vật tư ĐỌC profile để ẩn/hiện/khoá ô:
--   A — Đơn vị đơn      : đặt = giá = tồn, 1 đơn vị.        Thành tiền = SL × đơn giá.
--   B — Quy đổi cố định : đặt 1 đv, giá đv khác, hệ số CỨNG. Thành tiền = SL × hệ số × đơn giá.
--                         (ô SL-tính-giá khoá — dùng warehouse_materials.unit2_factor)
--   C — Cân thực tế     : SL & kg lưu RIÊNG, giá theo kg.   Thành tiền = kg thực × đơn giá.
--                         (unit2_factor = định mức kg/đơn-vị-đặt; ô kg prefill nhưng SỬA ĐƯỢC)
--
-- Ghi chú migration-state: các file 0042–0045 (item_master_erp/uom/fifo) CHƯA được apply lên
-- DB thực → cột vat_rate/default_supplier_id/last_purchase_price CHƯA tồn tại. Migration này
-- tự thêm 4 cột lái form, ĐỊNH NGHĨA KHỚP 0043 (add if not exists) nên vẫn tương thích nếu sau
-- này 0043 được apply. Tái dùng price_unit / unit2_factor đã có từ 0053.
--
-- RLS: warehouse_materials đã enable từ 0009 — chỉ ALTER, không đổi posture.
-- Idempotent: add column / drop-then-add constraint if not exists. Sau khi apply → SYNC TYPES.

-- Loại quy đổi (linh hồn form đặt) --------------------------------------------------
alter table public.warehouse_materials
  add column if not exists conversion_profile text not null default 'A';
alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_conversion_profile_check;
alter table public.warehouse_materials
  add constraint warehouse_materials_conversion_profile_check
  check (conversion_profile in ('A', 'B', 'C'));

-- Fields tự-điền lên đơn (khớp định nghĩa 0043 — an toàn nếu 0043 apply sau) --------
alter table public.warehouse_materials
  add column if not exists vat_rate numeric(5, 2)
    check (vat_rate is null or vat_rate between 0 and 100);      -- % VAT đầu vào mặc định
alter table public.warehouse_materials
  add column if not exists default_supplier_id uuid
    references public.supply_suppliers(id) on delete set null;  -- NCC ưu tiên
alter table public.warehouse_materials
  add column if not exists last_purchase_price numeric(14, 2)
    check (last_purchase_price is null or last_purchase_price >= 0); -- giá mua gần nhất (gợi ý)

-- Backfill dữ liệu cũ: giá đơn-vị-kép (price_unit đã khai) = profile B.
update public.warehouse_materials
  set conversion_profile = 'B'
  where price_unit is not null and conversion_profile = 'A';
