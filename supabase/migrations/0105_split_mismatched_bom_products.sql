-- TÁCH 8 SP BỊ KHỚP NHẦM MÃ CŨ THÀNH SẢN PHẨM RIÊNG (user chốt 30/07/2026).
--
-- ĐÃ APPLY qua MCP (`create_products_from_mismatched_bom`). File này giữ bản ghi
-- trong repo; nội dung SQL y hệt bản đã chạy.
--
-- Bối cảnh: `code_legacy` KHÔNG duy nhất về nghiệp vụ. 8 file BOM của app cũ khớp
-- sang bản ghi của SP khác hẳn (khác cả khách) — xem migration hoàn tác
-- `revert_bom_info_customer_mismatch`. Đối chiếu lại thư viện:
--   · 5 SP của file KHÔNG tồn tại trong DB (bistro, ghế WM, Tilos có ben, 2 bàn tròn)
--   · 3 SP chỉ có "họ hàng": có `Bộ sofa INAMI sắt` mà thiếu bản nhôm; có các món
--     rời Sigrid (CH0061/CH0070/TB0069) mà thiếu bản ghi cả bộ sắt
-- → tạo mới cả 8.
--
-- `code_legacy` để NULL: mã cũ đang thuộc bản ghi kia và có unique index. Đường
-- truy vết là `notes` — ghi thẳng đường dẫn file BOM nguồn + nói rõ mã cũ đang
-- thuộc SP nào, để sau này không ai khớp nhầm lần nữa.
--
-- Mã mới theo quy tắc `<LOẠI><4 số>HG-<VẬT LIỆU>`, serial = max hiện có + 1 theo
-- TỪNG loại: CH 205→206..209, ST 208→209..210, TB 208→209..210.
--
-- RLS: chỉ chèn dòng, giữ nguyên tư thế RLS của bảng.
-- Idempotent: `where not exists` theo `code`.
--
-- CHƯA làm: upload file BOM (.xlsx) và ảnh SP vào kho tài liệu của app — cần đi
-- qua storage + bảng `files`, làm riêng.

insert into public.technical_products (
  code, name, name_foreign, customer_name, customer_item_code, unit,
  product_type, frame_material, bom_status, is_active, notes,
  length_mm, width_mm, height_mm, length_open_mm, height_open_mm,
  frame_weight_kg, frame_length_m, paint_area_m2, part_count,
  bom_rev, bom_effective_date, packing
)
select v.code, v.name, v.name_foreign, v.customer_name, v.customer_item_code, 'cai',
       v.product_type, v.frame_material, 'none', true, v.notes,
       v.length_mm, v.width_mm, v.height_mm, v.length_open_mm, v.height_open_mm,
       v.frame_weight_kg, v.frame_length_m, v.paint_area_m2, v.part_count,
       v.bom_rev, v.bom_effective_date, v.packing
from (values
  ('CH0206HG-AL', 'Ghế 5 bậc', null, 'YOTRIO', null, 'CH', 'AL',
   'Tạo từ file BOM app cũ: YOTRIO\60_C0001HG-AL_Ghế 5 bậc — mã cũ C0001HG-AL đang thuộc SP khác (CH0001HG-AL, khách MERXX).',
   690::numeric, 615::numeric, 1090::numeric, null::numeric, null::numeric,
   3.007::numeric, 8.02::numeric, 0.8::numeric, 19, 1, '2026-02-28'::date,
   '{"carton_l_cm":64,"carton_w_cm":113,"carton_h_cm":14,"qty_per_carton":1,"pack_unit_label":"ctn","loading_40hc":728}'::jsonb),
  ('CH0207HG-AL', 'Ghế bistro Yotrio', 'Bistro Chair', 'YOTRIO', null, 'CH', 'AL',
   'Tạo từ file BOM app cũ: YOTRIO\83_C0083HG-AL_Ghế bistro yotrio — mã cũ C0083HG-AL đang thuộc SP khác (CH0083HG-AL, khách CASUAL).',
   490, 490, 750, null, null, 3.0, 6.264, 0.755, 22, 1, '2026-02-28',
   '{"carton_l_cm":86,"carton_w_cm":56,"carton_h_cm":19,"qty_per_carton":2,"pack_unit_label":"ctn","loading_40hc":732}'::jsonb),
  ('CH0208HG-AL', 'Ghế WM 56x56x91', null, 'YOTRIO_WM', null, 'CH', 'AL',
   'Tạo từ file BOM app cũ: YOTRIO_WM\89_C0089HG-AL_Ghế wm 56x56x91 — mã cũ C0089HG-AL đang thuộc SP khác (CH0089HG-AL, khách CASUAL).',
   560, 560, 910, null, null, 7.755, 8.748, 1.081, 16, 1, null,
   '{"carton_l_cm":95,"carton_w_cm":65,"carton_h_cm":54,"qty_per_carton":1,"pack_unit_label":"ctn","loading_40hc":200}'::jsonb),
  ('CH0209HG-AL', 'Ghế nhôm lưới Tilos có ben, khung nhôm (Ghế San Remo nhôm lưới)', null, 'MERXX', '21590-217', 'CH', 'AL',
   'Tạo từ file BOM app cũ: MERXX\113_C0113HG-AL_Ghế nhôm lưới Tilos có ben — mã cũ C0113HG-AL đang thuộc SP khác (CH0113HG-AL "Armchair", khách LAURA).',
   760, 580, 1110, 935, 995, 4.313, 11.736, 2.01, 37, 1, '2026-02-28',
   '{"carton_l_cm":75,"carton_w_cm":60,"carton_h_cm":255,"qty_per_carton":1,"pack_unit_label":"ctn","loading_40hc":720,"nw_kg":5.8}'::jsonb),
  ('ST0209HG-IR', 'Bộ Sigrid sắt (sofa góc)', 'Bộ Sofa góc', 'Laura', null, 'ST', 'IR',
   'Tạo từ file BOM app cũ: Laura\76_S0076HG-IR_Bộ Sigrid sắt — mã cũ S0076HG-IR đang thuộc SP khác (ST0076HG-IR "Lucas set - Bank II", khách AlphaMarts).',
   2395, 2395, 520, null, null, 38.521, 62.94, 6.817, 6, 1, null,
   '{"carton_l_cm":88,"carton_w_cm":88,"carton_h_cm":193,"qty_per_carton":1,"pack_unit_label":"ctn","loading_40hc":44}'::jsonb),
  ('ST0210HG-AL', 'Bộ sofa INAMI (nhôm)', null, 'Laura', null, 'ST', 'AL',
   'Tạo từ file BOM app cũ: Laura\86_S0086HG-AL_Bộ sofa INAMI — mã cũ S0086HG-AL đang thuộc SP khác (ST0086HG-AL "Wilder 8-piece Sectional", khách AE). Bản SẮT của bộ này là ST0087HG-IR.',
   2610, 1995, 680, null, null, 21.646, 54.285, 7.77, 13, 1, null, '{}'::jsonb),
  ('TB0209HG-AL', 'Bàn tròn Ø915', null, 'YOTRIO_WM', null, 'TB', 'AL',
   'Tạo từ file BOM app cũ: YOTRIO_WM\88_T0088HG-AL_Bàn tròn 975 — mã cũ T0088HG-AL đang thuộc SP khác (TB0088HG-AL, khách CASUAL).',
   975, 975, 405, null, null, 16.405, 9.83, 2.858, 5, 1, null,
   '{"carton_l_cm":106.5,"carton_w_cm":100,"carton_h_cm":13,"qty_per_carton":1,"pack_unit_label":"ctn","loading_40hc":483}'::jsonb),
  ('TB0210HG-AL', 'Bàn tròn Ø510', null, 'YOTRIO_WM', null, 'TB', 'AL',
   'Tạo từ file BOM app cũ: YOTRIO_WM\91_T0091HG-AL_Bàn tròn WM 573 — mã cũ T0091HG-AL đang thuộc SP khác (TB0091HG-AL "Coffee table-TRISTAN", khách LAURA).',
   573, 573, 460, null, null, 8.043, 5.015, 1.392, 4, 1, null,
   '{"carton_l_cm":67.5,"carton_w_cm":61,"carton_h_cm":18.5,"qty_per_carton":1,"pack_unit_label":"ctn","loading_40hc":879}'::jsonb)
) as v(code, name, name_foreign, customer_name, customer_item_code, product_type, frame_material,
       notes, length_mm, width_mm, height_mm, length_open_mm, height_open_mm,
       frame_weight_kg, frame_length_m, paint_area_m2, part_count, bom_rev, bom_effective_date, packing)
where not exists (select 1 from public.technical_products p where p.code = v.code);
