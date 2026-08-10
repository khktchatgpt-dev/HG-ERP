-- HỢP NHẤT KÍCH THƯỚC SẢN PHẨM VỀ MỘT BỘ: milimét.
--
-- Bối cảnh: dài×rộng×cao của SP đang nằm ở HAI nơi, hai đơn vị, hai phòng điền —
--   `packing.l_cm / w_cm / h_cm`        (cm, Kinh doanh gõ tay — 12/593 SP)
--   `length_mm / width_mm / height_mm`  (mm, trích từ file BOM — 353/593 SP)
-- Báo giá chỉ đọc bộ cm nên in trống kích thước với ~98% SP; và 3/4 SP có cả hai
-- thì lệch nhau. Xem docs/bao-gia-upload-excel-plan.md §2.
--
-- Quy ước chốt theo BẢNG KÊ QUY CÁCH của công ty (BKQC - C0065HG-AL):
--     "KTTT: 548 x 565 x 876   (L/D x W x H) mm"
-- ⇒ Dài(/Sâu) × Rộng × Cao, đơn vị mm. Bộ mm là NGUỒN ĐÚNG (chính SP đó đang
-- lệch, và bộ mm khớp bảng kê còn bộ cm là số làm tròn sai).
--
-- Migration này:
--   1. SP chỉ có cm → chuyển sang mm (×10), GIỮ NGUYÊN thứ tự trục. KHÔNG tự
--      hoán vị: 3 SP đang ghi theo lối "l = cạnh dài nhất" thay vì "l = sâu",
--      nhưng đoán thay người dùng thì rủi ro hơn là nêu ra để họ sửa.
--   2. SP có cả hai → GIỮ bộ mm, bỏ bộ cm.
--   3. ST0076HG-IR là ngoại lệ: `is_set = true` ("1 Bank II + 1 Table"), bộ cm
--      (239,5×239,5×52) là kích thước CẢ BỘ còn bộ mm (1520×800×760) là một món
--      bàn. Hai số đo hai vật khác nhau nên không cái nào sai — chép số của bộ
--      vào `notes` để không mất, mm giữ nguyên.
--   4. Xoá hẳn 3 khoá l_cm/w_cm/h_cm khỏi `packing`.
--
-- Sao lưu trước khi chạy: supabase/backups/2026-08-10_product_dims_cm.json
-- RLS: không đổi (bảng đã enable, no policies). Idempotent: chạy lại vô hại vì
-- bước 1 chỉ điền khi mm đang trống, bước 4 xoá khoá đã không còn thì cũng không sao.

-- 1) SP chỉ có cm → sang mm. Chỉ điền khi mm đang trống, không đè số của Kỹ thuật.
update public.technical_products
set
  length_mm = coalesce(length_mm, round((nullif(packing->>'l_cm','')::numeric) * 10, 1)),
  width_mm  = coalesce(width_mm,  round((nullif(packing->>'w_cm','')::numeric) * 10, 1)),
  height_mm = coalesce(height_mm, round((nullif(packing->>'h_cm','')::numeric) * 10, 1))
where nullif(packing->>'l_cm','') is not null
   or nullif(packing->>'w_cm','') is not null
   or nullif(packing->>'h_cm','') is not null;

-- 3) Ngoại lệ SET: giữ lại kích thước cả bộ dưới dạng ghi chú, không mất thông tin.
update public.technical_products
set notes = concat_ws(
      E'\n',
      nullif(notes, ''),
      'Kích thước cả bộ (từ ô cm cũ): 2395 x 2395 x 520 mm — số ở KT sản phẩm là của món bàn.'
    )
where code = 'ST0076HG-IR'
  and (notes is null or notes not like '%Kích thước cả bộ%');

-- 4) Bỏ hẳn ba khoá kích thước SP khỏi `packing`. Các khoá đóng gói (carton_*,
--    qty_per_carton, nw/gw, loading_40hc, pack_unit_label, cbm) GIỮ NGUYÊN.
update public.technical_products
set packing = (packing - 'l_cm' - 'w_cm' - 'h_cm')
where packing ?| array['l_cm', 'w_cm', 'h_cm'];
