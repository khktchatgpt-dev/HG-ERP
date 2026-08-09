-- 0124: Đóng gói mua + Vật liệu/màu cho danh mục vật tư (warehouse_materials).
--
-- pack_size / pack_unit — quy cách ĐÓNG GÓI KHI MUA: 1 <pack_unit> = <pack_size>
--   <ĐVT gốc> (vd 1 bì = 500 con). Đơn thật của Cung ứng (THP, LSX 01) cần
--   13.596 con nút bịt nhưng NCC bán theo bì 500 con — nhân viên phải tự chia
--   tay trong Excel. Có hai cột này thì form đặt gợi ý SL tròn bao.
-- material_grade — cột "Vật liệu" trên đơn phụ kiện/inox ("Nhựa đen", "Sắt xi
--   trắng", "inox 201"). Trước chỉ chép từ LẦN ĐẶT TRƯỚC (po lines), vật tư mới
--   khai thì trống; khai một lần ở danh mục thì đơn đầu tiên đã tự điền.
--
-- RLS: bảng đã enable row level security KHÔNG policy (anon bị chặn, secret key
-- bypass) — thêm cột không đổi tư thế bảo mật.

alter table warehouse_materials
  add column if not exists pack_size numeric,
  add column if not exists pack_unit text,
  add column if not exists material_grade text;

comment on column warehouse_materials.pack_size is
  'Đóng gói mua: 1 pack_unit = pack_size ĐVT gốc (vd 500 con/bì). NULL = mua lẻ theo ĐVT.';
comment on column warehouse_materials.pack_unit is
  'Tên đơn vị đóng gói khi mua: bì / bó / thùng / bao…';
comment on column warehouse_materials.material_grade is
  'Vật liệu / màu in ở cột "Vật liệu" của đơn đặt: Nhựa đen, Sắt xi trắng, inox 201…';
