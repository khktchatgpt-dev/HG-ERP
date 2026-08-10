-- 0128: Chụp ĐÓNG GÓI MUA vào dòng đơn đặt (supply_purchase_order_lines).
--
-- pack_size / pack_unit của vật tư đã có từ 0124 nhưng chỉ sống trong form soạn
-- đơn: dòng chữ "≈ 27,2 bì" và nút làm tròn lên nguyên bao. Dòng đơn KHÔNG lưu,
-- nên phiếu in gửi NCC không bao giờ nói được đơn này bằng bao nhiêu bao — NCC
-- nhận "13.596 Con" trong khi họ bán theo bì 500 con, rồi tự chia tay.
--
-- Chụp vào dòng chứ không join lại danh mục lúc in, cùng lý do với qty_on_hand:
-- đóng gói đổi về sau (NCC chuyển từ bì 500 sang bì 1.000) thì đơn ĐÃ KÝ phải in
-- lại đúng con số hai bên thoả thuận lúc đặt, không phải con số hôm nay.
--
-- Không ảnh hưởng tiền: SL đặt vẫn luôn theo ĐVT gốc, đây chỉ là số quy đổi để
-- đọc. Đơn cũ để NULL — phiếu in tự ẩn dòng quy đổi như trước.
--
-- RLS: bảng đã enable row level security KHÔNG policy (anon bị chặn, secret key
-- bypass) — thêm cột không đổi tư thế bảo mật.

alter table supply_purchase_order_lines
  add column if not exists pack_size numeric,
  add column if not exists pack_unit text;

comment on column supply_purchase_order_lines.pack_size is
  'Ảnh chụp đóng gói mua lúc lập đơn: 1 pack_unit = pack_size ĐVT gốc. NULL = mua lẻ theo ĐVT.';
comment on column supply_purchase_order_lines.pack_unit is
  'Tên đơn vị đóng gói lúc lập đơn: bì / bó / thùng / bao…';
