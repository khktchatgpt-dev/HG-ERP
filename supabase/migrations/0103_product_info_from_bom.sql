-- ĐIỀN THÔNG TIN SẢN PHẨM TỪ FILE BOM CỦA APP CŨ (user chốt 30/07/2026).
--
-- Nguồn: 61 file .xlsx trong app Hoanggia cũ
-- (`www/Hoanggia/uploads/products` + `public/uploads/products`), mẫu HG-QT-07/M02.
-- Khớp sang `technical_products` bằng `code_legacy` — 67/67 mã có SP tương ứng.
--
-- CHỈ ĐIỀN Ô ĐANG TRỐNG, KHÔNG BAO GIỜ GHI ĐÈ (`coalesce(p.x, s.x)`).
-- Lý do: chỗ nào DB đã có số thì số đó LỆCH với file ở 100% trường hợp
-- (38/38 `part_count`, 5/5 `frame_weight_kg`, 5/5 `length_mm`) — hai bên là hai
-- bản BOM khác nhau, không có căn cứ để bảo bản nào đúng. Đã kiểm tay file
-- C0065HG-AL: cách đọc ô của bộ trích khớp chính xác với file. Các chỗ lệch để
-- người phụ trách tự quyết trong giao diện.
--
-- Đã CỐ Ý bỏ, không nhét vào migration:
--   · `net_weight_kg` — 54/67 file ghi "KL.Thực tế" bằng công thức trỏ vào dòng
--     Tổng cộng, tức KHÔNG phải số cân thật như cột này yêu cầu.
--   · kích thước/GW của các dòng đóng gói ghi 'Ncái / pallet' — đó là số của cả
--     pallet (có file ghi GW 201kg cho "1 thùng" ghế NW 7.8kg).
--   · KTSP dạng gập/mở ('760/ 935 x 1110/…', 15 SP) — không tự chọn được bộ số.
--   · Σ trọng lượng khung < 0.5kg (2 SP) — công thức trong file hỏng.
--   · 6 SP là BỘ nhiều món, mỗi món một sheet — không gộp về một hồ sơ SP được.
--
-- `packing` (jsonb) trộn theo hướng GIỮ giá trị cũ: `mới || cũ` — toán tử `||`
-- cho vế PHẢI thắng, nên khoá đã có trong DB không bị đụng.
--
-- RLS: không tạo bảng/view mới. `technical_products` đã bật RLS không policy từ
-- migration gốc (anon bị chặn, secret key bypass) — giữ nguyên.
--
-- Idempotent: mệnh đề `is distinct from` ở cuối khiến lần chạy thứ hai không
-- update dòng nào (không đụng cả `updated_at`).

with src(legacy_code, customer_item_code, length_mm, width_mm, height_mm, frame_weight_kg, frame_length_m, paint_area_m2, part_count, bom_rev, bom_effective_date, carton_l_cm, carton_w_cm, carton_h_cm, qty_per_carton, pack_unit_label, loading_40hc, nw_kg, gw_kg) as (values
  ('B0066HG-AL'::text, null::text, null::numeric, null::numeric, null::numeric, 3.395::numeric, 2.205::numeric, 0.185::numeric, 4::int, 1::int, null::date, 127.0::numeric, 91.5::numeric, 16.0::numeric, 1::int, 'ctn'::text, 360::int, null::numeric, null::numeric),
  ('B0067HG-AL', null, null, null, null, 4.697, 4.41, 0.371, 8, 1, null, 184.0, 94.5, 16.0, 1, 'ctn', 240, null, null),
  ('B0203HG-AL', 'FZA30747A', 580, 1205, 875, 3.479, 12.406, 1.236, 14, 1, '2026-02-28', 118.0, 63.0, 22.0, 1, 'ctn', 400, null, null),
  ('B0204HG-AL', 'FZA30748', 600, 1800, 870, 4.335, 15.503, 1.537, 14, 1, '2026-02-28', 178.0, 63.0, 22.0, 1, 'ctn', 266, null, null),
  ('C0001HG-AL', null, 690, 615, 1090, 3.007, 8.02, 0.8, 19, 1, '2026-02-28', 64.0, 113.0, 14.0, 1, 'ctn', 728, null, null),
  ('C0065HG-AL', 'FZA30095J', 600, 580, 870, 2.448, 11.13, 0.882, 20, 1, '2026-02-28', null, null, null, 30, 'pallet', 1170, null, null),
  ('C0070HG-IR', null, 850, 895, 520, 9.874, 15.585, 1.689, 6, 1, null, 88.0, 88.0, 54.0, 1, 'ctn', 160, null, null),
  ('C0083HG-AL', null, 490, 490, 750, 3.0, 6.264, 0.755, 22, 1, '2026-02-28', 86.0, 56.0, 19.0, 2, 'ctn', 732, null, null),
  ('C0089HG-AL', null, 560, 560, 910, 7.755, 8.748, 1.081, 16, 1, null, 95.0, 65.0, 54.0, 1, 'ctn', 200, null, null),
  ('C0090HG-AL', null, 760, 610, 910, 8.445, 9.548, 1.186, 16, 1, null, 95.0, 80.0, 54.0, 1, 'ctn', 163, null, null),
  ('C0095HG-AL', null, 620, 680, 990, 3.119, 10.969, 1.099, 19, 1, null, null, null, null, null, null, null, null, null),
  ('C0113HG-AL', '21590-217', null, null, null, 4.313, 11.736, 2.01, 37, 1, '2026-02-28', 75.0, 60.0, 255.0, 1, 'ctn', 720, 5.8, null),
  ('C0114HG-AL', '22020-209', null, null, null, null, 6.402, 0.701, 20, 1, '2026-02-28', 90.0, 60.0, 13.0, 1, 'ctn', 1022, null, null),
  ('C0119HG-AL', '21600-217', null, null, null, 4.762, 10.356, 1.933, 14, 1, '2026-06-19', 103.0, 61.5, 13.0, 1, 'ctn', null, 5.5, 7.0),
  ('C0162HG-AL', '21601-217', 560, 615, 910, null, null, null, null, 1, '2026-02-28', null, null, null, 30, 'pallet', 30, null, null),
  ('C0165HG-AL', '22000-309', 550, 610, 840, 1.985, 6.907, 0.651, 12, 1, '2026-02-28', null, null, null, 30, 'pallet', null, null, null),
  ('C0170HG-AL', '22014-307', null, null, null, 2.669, 9.375, 0.848, 15, 1, '2026-02-28', 94.0, 60.5, 18.5, 1, 'ctn', null, 5.3, 7.0),
  ('C0172HG-AL', '22021-209', 610, 540, 840, 1.772, 6.55, 0.599, 12, 1, '2026-02-28', null, null, null, 50, 'pallet', null, null, null),
  ('C0175HG-AL', '22029-209', 620, 560, 970, 1.33, 8.292, 0.711, 12, 1, '2026-02-28', 128.0, 59.0, 25.0, 2, 'ctn', null, 9.0, 11.2),
  ('C0176HG-AL', '22060-217', null, null, null, 2.415, 7.59, 0.81, 14, 1, '2026-02-28', 96.0, 63.0, 15.0, 1, 'ctn', null, 7.8, 9.4),
  ('C0177HG-AL', '26300-309', 660, 595, 1010, 2.133, 9.018, 0.859, 12, 1, '2026-02-28', null, null, null, 25, 'pallet', null, null, null),
  ('C0180HG-AL', '26010-309', null, null, null, null, 7.956, 0.172, 30, 1, '2026-02-28', 93.0, 62.0, 16.0, 1, 'ctn', null, 4.5, 6.0),
  ('C0194HG-AL', null, 629, 673, 800, 2.555, 8.484, 2.243, 16, null, null, 101.7, 69.3, 236.8, 25, 'ctn', 900, null, null),
  ('C0195HG-IN', '22120-011', null, null, null, 6.452, 6.58, 0.794, 18, 1, '2026-02-28', 101.0, 62.0, 10.5, 1, 'ctn', 865, 11.0, 12.6),
  ('C0197HG-AL', '22121-011', 555, 630, 935, 1.37, 5.132, 0.531, 12, 1, '2026-02-28', null, null, null, 25, 'pallet', null, null, null),
  ('C0200HG-AL', '26004-309', null, null, null, null, null, null, null, 1, '2026-02-28', null, null, null, 1, 'ctn', null, null, null),
  ('C0201HG-IN', '26620-309', null, null, null, 5.51, 10.816, 0.682, 52, 1, '2026-02-28', 99.0, 61.0, 15.0, 1, 'ctn', null, 8.4, 10.0),
  ('D0085HG-AL', null, 900, 2000, 750, 11.261, 17.05, 3.283, 16, 1, '2026-02-28', 204.5, 93.0, 28.0, 7, 'ctn', 125, null, null),
  ('O0082HG-AL', null, 700, 1610, 750, 4.361, 8.946, 1.389, null, 1, '2026-02-28', 164.0, 73.0, 21.0, 3, 'ctn', 266, null, null),
  ('O0178HG-AL', '22150-011', 400, 1200, 1400, 1.707, 4.2, 0.613, 20, 1, '2026-02-28', 144.0, 56.0, 20.0, 1, 'ctn', null, 17.5, 19.0),
  ('O0179HG-AL', '22151-011', 400, 400, 1400, 1.707, 4.2, 0.613, 20, 1, '2026-02-28', 243.0, 42.0, 10.0, 1, 'ctn', null, 9.0, 10.5),
  ('S0076HG-IR', null, 2395, 2395, 520, 38.521, 62.94, 6.817, 6, 1, null, 88.0, 88.0, 193.0, 1, 'ctn', 44, null, null),
  ('S0084HG-AL', null, 700, 1100, 420, 3.702, 10.23, 1.161, 10, 1, '2026-02-28', 198.0, 73.0, 60.0, 4, 'ctn', 77, null, null),
  ('S0086HG-AL', null, 2610, 1995, 680, 21.646, 54.285, 7.77, 13, 1, null, null, null, null, null, null, null, null, null),
  ('S0087HG-IR', null, 2610, 1995, 680, 50.329, 54.285, 7.77, 13, 1, null, null, null, null, null, null, null, null, null),
  ('SU0092HG-AL', null, null, null, null, 14.925, 19.945, 2.078, 14, 1, null, 205.0, 66.5, 18.5, 1, 'ctn', 271, null, null),
  ('SU0181HG-AL', '22016-309', null, null, null, 5.816, 19.938, 2.159, 56, 1, '2026-02-28', 196.0, 85.5, 14.0, 1, 'ctn', null, null, null),
  ('T0068HG-IR', null, 600, 950, 400, 5.09, 8.84, 0.85, 12, 1, null, 13.0, 65.0, 105.0, 1, 'ctn', 755, null, null),
  ('T0069HG-IR', null, 600, 1000, 350, 6.137, 10.88, 0.99, 12, 1, null, 16.0, 69.0, 107.0, 1, 'ctn', 567, null, null),
  ('T0077HG-AL', null, 890, 890, 745, 3.602, 6.825, 1.128, 13, 1, '2026-02-28', 92.0, 92.0, 10.0, 1, 'ctn', 767, null, null),
  ('T0078HG-AL', null, 890, 1370, 745, 4.054, 5.275, 1.272, 11, 1, '2026-02-28', 140.0, 92.0, 10.0, 1, 'ctn', 504, null, null),
  ('T0080HG-AL', null, 700, 700, 1100, 4.417, 9.425, 1.408, 11, 1, '2026-02-28', 116.0, 76.0, 14.0, 1, 'ctn', 542, null, null),
  ('T0081HG-AL', null, 700, 1420, 1100, 5.79, 13.99, 1.795, 11, 1, '2026-02-28', 145.0, 76.0, 14.0, 1, 'ctn', 434, null, null),
  ('T0088HG-AL', null, 975, 975, 405, 16.405, 9.83, 2.858, 5, 1, null, 106.5, 100.0, 13.0, 1, 'ctn', 483, null, null),
  ('T0091HG-AL', null, 573, 573, 460, 8.043, 5.015, 1.392, 4, 1, null, 67.5, 61.0, 18.5, 1, 'ctn', 879, null, null),
  ('T0093HG-AL', null, 560, 560, 910, 6.597, 8.247, 1.054, 17, 1, null, 55.0, 55.0, 9.0, 1, 'ctn', 2460, null, null),
  ('T0094HG-AL', null, 1725, 1000, 725, 31.785, 8.373, 6.287, 14, 1, null, 102.7, 100.5, 15.0, 1, 'ctn', 432, null, null),
  ('T0163HG-AL', '21604-217', 900, 1500, 740, 3.877, 9.192, 1.434, 19, 1, '2026-02-28', 154.0, 95.0, 12.5, 1, 'ctn', null, 16.2, 20.0),
  ('T0164HG-AL', '21608-217', null, null, null, 6.626, 12.236, 1.965, 22, 1, '2026-02-28', 184.0, 105.0, 12.0, 1, 'ctn', null, 28.5, 33.0),
  ('T0166HG-AL', '22002-217', 900, 1500, 740, 3.837, 8.57, 1.414, 34, 1, '2026-02-28', 155.0, 95.0, 10.0, 1, 'ctn', null, 16.8, 20.0),
  ('T0167HG-AL', '22002-217', 900, 1500, 740, 3.837, 8.57, 1.414, 34, 1, '2026-02-28', 155.0, 95.0, 10.0, 1, 'ctn', null, 16.8, 20.0),
  ('T0168HG-AL', '22009 - 219', null, null, null, 3.317, 7.342, 1.097, 14, 1, null, 85.0, 75.0, 21.0, 1, 'ctn', null, 11.5, 13.5),
  ('T0169HG-AL', '22012-217', null, null, null, 7.43, 21.674, 2.984, 24, 1, '2026-02-28', 184.0, 105.0, 13.0, 1, 'ctn', null, 30.0, 34.0),
  ('T0171HG-AL', '22018 - 217', 315, 415, 610, 0.986, 4.04, 0.411, 10, 1, null, 57.5, 33.0, 8.0, 1, 'ctn', null, 2.5, 3.0),
  ('T0173HG-AL', '22027-209', null, null, null, 2.964, 5.72, 0.933, 20, 1, '2026-02-28', 70.0, 70.0, 13.5, 1, 'ctn', null, 11.3, 13.0),
  ('T0174HG-AL', '22028-209', null, null, null, 2.493, 13.763, 1.263, 14, 1, '2026-02-28', 24.0, 62.0, 92.0, 1, 'ctn', null, 7.0, 9.0),
  ('T0182HG-AL', '22024-209', null, null, null, 5.978, 11.232, 1.809, 30, 1, '2026-02-28', null, null, null, null, null, null, null, null),
  ('T0198HG-IN', '22122-011', 900, 1500, 750, 11.407, 10.002, 1.359, 33, 1, '2026-02-28', 156.0, 97.0, 10.0, 1, 'ctn', null, 27.0, 30.0),
  ('T0199HG-IN', '22125-011', null, null, null, 17.471, 16.126, 2.056, 41, 1, '2026-02-28', 185.0, 106.0, 14.0, 1, 'ctn', null, 40.0, 45.0),
  ('T0202HG-AL', 'FTA20904X', 890, 1600, 745, 4.503, 9.52, 1.561, 14, 1, '2026-02-28', 160.0, 92.0, 12.0, 1, 'ctn', 384, null, null),
  ('T0207HG-AL', null, 600, 1200, 405, 7.287, 14.12, 2.348, 22, 1, '2026-02-28', 124.0, 64.0, 10.0, 1, 'ctn', 844, null, null)
),
calc as (
  select p.id,
         coalesce(p.customer_item_code, s.customer_item_code) as customer_item_code,
         coalesce(p.length_mm, s.length_mm) as length_mm,
         coalesce(p.width_mm, s.width_mm) as width_mm,
         coalesce(p.height_mm, s.height_mm) as height_mm,
         coalesce(p.frame_weight_kg, s.frame_weight_kg) as frame_weight_kg,
         coalesce(p.frame_length_m, s.frame_length_m) as frame_length_m,
         coalesce(p.paint_area_m2, s.paint_area_m2) as paint_area_m2,
         coalesce(p.part_count, s.part_count) as part_count,
         coalesce(p.bom_rev, s.bom_rev) as bom_rev,
         coalesce(p.bom_effective_date, s.bom_effective_date) as bom_effective_date,
         jsonb_strip_nulls(jsonb_build_object(
            'carton_l_cm', s.carton_l_cm,
            'carton_w_cm', s.carton_w_cm,
            'carton_h_cm', s.carton_h_cm,
            'qty_per_carton', s.qty_per_carton,
            'pack_unit_label', s.pack_unit_label,
            'loading_40hc', s.loading_40hc,
            'nw_kg', s.nw_kg,
            'gw_kg', s.gw_kg
         )) || coalesce(p.packing, '{}'::jsonb) as packing
  from public.technical_products p
  join src s on s.legacy_code = p.code_legacy
)
update public.technical_products p
set
  customer_item_code = c.customer_item_code,
  length_mm = c.length_mm,
  width_mm = c.width_mm,
  height_mm = c.height_mm,
  frame_weight_kg = c.frame_weight_kg,
  frame_length_m = c.frame_length_m,
  paint_area_m2 = c.paint_area_m2,
  part_count = c.part_count,
  bom_rev = c.bom_rev,
  bom_effective_date = c.bom_effective_date,
  packing = c.packing
from calc c
where c.id = p.id
  and (p.customer_item_code, p.length_mm, p.width_mm, p.height_mm, p.frame_weight_kg, p.frame_length_m, p.paint_area_m2, p.part_count, p.bom_rev, p.bom_effective_date, p.packing)
   is distinct from
      (c.customer_item_code, c.length_mm, c.width_mm, c.height_mm, c.frame_weight_kg, c.frame_length_m, c.paint_area_m2, c.part_count, c.bom_rev, c.bom_effective_date, c.packing);
