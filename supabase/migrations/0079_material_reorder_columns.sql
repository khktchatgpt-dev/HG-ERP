-- 0079_material_reorder_columns.sql — Bổ sung cột bù tồn còn thiếu trên DB thật
--
-- 0043 khai max_stock/reorder_point/reorder_qty nhưng CHƯA từng apply lên DB
-- (ghi chú trong 0055: "0042–0045 có thể chưa apply"). Nghiệp vụ ① mua bù tồn
-- cần 3 cột này — thêm lại idempotent theo đúng pattern 0055.
--
--   max_stock     : trần tồn — không có lô đặt thì gợi ý bù tới mức này.
--   reorder_point : ngưỡng đặt lại — vị thế (khả dụng + đang về) tụt dưới → gợi ý mua.
--                   Bỏ trống = dùng min_stock làm ngưỡng.
--   reorder_qty   : lô đặt cố định — mỗi lần gợi ý đúng số này.
--
-- RLS: không đổi (bảng đã enable RLS, no policies). Idempotent.

alter table public.warehouse_materials
  add column if not exists max_stock numeric(18, 4) check (max_stock >= 0);
alter table public.warehouse_materials
  add column if not exists reorder_point numeric(18, 4) check (reorder_point >= 0);
alter table public.warehouse_materials
  add column if not exists reorder_qty numeric(18, 4) check (reorder_qty >= 0);

comment on column public.warehouse_materials.reorder_point is
  'Ngưỡng đặt lại (0079): vị thế tồn tụt dưới → gợi ý mua bù trên PO ngoài LSX. NULL = dùng min_stock.';
