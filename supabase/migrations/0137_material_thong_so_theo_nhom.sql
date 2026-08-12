-- Vật tư: THÔNG SỐ THEO NHÓM — chọn vật tư là dòng đơn có đủ thông tin.
--
-- Vì sao (user 12/08/2026): "thông tin vật tư lưu khá nghèo nàn... khi chọn
-- vật tư sẽ có đủ thông tin trên các form; nhiều loại vật tư, mỗi loại cần
-- thông tin khác nhau". Đối chiếu cột của các mẫu đơn với material master:
-- ba ô đang CHỈ nhớ được từ "lần đặt gần nhất" (vật tư chưa từng lên đơn thì
-- trống, phải gõ tay):
--   open_style   bao bì: cách mở thùng AD / MR / ĐK — quyết định công thức m²
--   pcs_per_ctn  bao bì: số SP đóng trong một thùng
--   finish       kim loại: màu / bề mặt ("inox bóng", "xi trắng", "sơn đen")
-- Các loại còn lại đã có chỗ: kích thước (spec — kính/xốp/carton tự bóc),
-- barem kg (kg_per_m/kg_per_unit), đóng gói (pack_*), vật liệu/mã màu/định mức
-- (material_grade), quy đổi giá (price_unit/unit2_factor).
--
-- Form khai vật tư hiện khối "thông số theo nhóm" tương ứng (bao bì hỏi cách
-- mở + pcs/thùng; kim loại hỏi màu/bề mặt; kính/xốp gợi ý quy cách D×R×dày)
-- — cấu hình ở src/lib/material-group-fields.ts.
--
-- RLS: không tạo bảng mới — warehouse_materials đã enable RLS no-policies.
-- Idempotent.

alter table public.warehouse_materials
  add column if not exists open_style text;

alter table public.warehouse_materials
  add column if not exists pcs_per_ctn numeric(14, 2)
    check (pcs_per_ctn is null or pcs_per_ctn > 0);

alter table public.warehouse_materials
  add column if not exists finish text;
