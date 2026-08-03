-- KHỐI LƯỢNG MỖI ĐƠN VỊ ĐẶT — cho hàng TẤM / CUỘN.
--
-- Bối cảnh: hai mẫu đơn tính tiền theo khối lượng (`aluminium`, `metal_kg`) đang
-- lấy barem từ `kg_per_m × default_bar_length_m`. Mô hình đó chỉ đúng với hàng
-- CÂY. Tấm inox, tôn cuộn, lưới… cân theo TẤM: đơn thật của phòng Cung ứng ghi
-- thẳng cột "Trọng lượng tấm (kg)" (Thông Đạt, Hào Tư Hùng) hoặc "Kg/tấm"
-- (Cát Tường), không có cột nào theo mét dài.
--
-- Hệ quả trước migration này: 39 vật tư ĐVT "tấm" + 1 "cuộn" đều để trống cả
-- kg_per_m lẫn default_bar_length_m (đúng — hai ô đó vô nghĩa với chúng), nên
-- dòng đặt KHÔNG được điền sẵn kg/đơn-vị. Người soạn đơn phải gõ tay mỗi lần,
-- mà `lineReady` lại CHẶN gửi khi ô đó trống — kết cục quen thuộc: gõ đại một số
-- cho qua, rồi (SL × kg/đv) × giá/kg đi thẳng lên bàn duyệt của Giám đốc.
--
-- Cột này là chỗ khai MỘT LẦN ở danh mục, để mọi đơn sau tự điền — đúng cách
-- hàng cây đang được phục vụ.
--
-- Thứ tự ưu tiên khi dựng dòng đặt (xem `kgPerOrderUnit`):
--   1. kg_per_unit          — số cân thật, khai tay, đúng cho MỌI dạng hàng
--   2. kg_per_m × dài cây   — suy ra, chỉ dùng được cho hàng cây/thanh
--
-- KHÔNG backfill: cả 40 vật tư tấm/cuộn hiện chưa có số cân nào trong hệ thống
-- để suy ra. Đoán ở đây là sai tiền, nên để trống và hỏi người dùng.
--
-- RLS: `warehouse_materials` đã bật row level security không policy từ 0040 —
-- thêm cột không đổi tư thế đó (anon bị chặn, secret key bypass). Không đụng.

alter table public.warehouse_materials
  add column if not exists kg_per_unit numeric(14, 4);

comment on column public.warehouse_materials.kg_per_unit is
  'Khối lượng mỗi ĐƠN VỊ ĐẶT (kg/tấm, kg/cuộn, kg/cây). Điền sẵn ô "kg / đơn vị" '
  'của dòng đơn mẫu inox-sắt. Ưu tiên hơn kg_per_m × default_bar_length_m.';
