-- Kỹ thuật: tách nhóm "Vật tư / phụ kiện" thành các nhóm con có nghĩa với xưởng.
--
-- Bối cảnh: user hỏi "định mức ngũ kim đâu". Trong 247 file BOM gốc KHÔNG có
-- mục nào tên "ngũ kim" — bu lông, tán rút, lông đền, pát, tăng đơ nằm lẫn trong
-- mục "VẬT TƯ" cùng với sơn, hoá chất, dây đan và cả vật tư đóng gói. Nhóm
-- HARDWARE của 0093 vì thế đang gom 4 bản chất khác nhau vào một chỗ.
--
-- 0093 đã biến nhóm hạng mục thành DỮ LIỆU (có parent_code để lồng cấp), nên
-- việc này chỉ là thêm bản ghi danh mục — không đổi cấu trúc bảng, không cần
-- sửa code. `technical_product_parts.group_code` là khoá ngoại nên phải apply
-- migration này TRƯỚC khi chạy `scripts/products-import.mjs`.
--
--   NGU_KIM  ← con của HARDWARE   bu lông, ốc vít, tán, lông đền, pát, tăng đơ
--   SON_HC   ← con của HARDWARE   sơn, bột sơn, hoá chất, keo
--   DAY_DAN  ← con của OTHER      dây dù, mây, textilene, công đan
--
-- HARDWARE giữ nguyên cho phần phụ kiện còn lại. Dòng định mức cũ mang
-- group_code = 'HARDWARE' vẫn hợp lệ, không phải sửa gì.
--
-- RLS: không tạo bảng mới, giữ nguyên posture của 0093 (enable, no policies).
-- Idempotent: insert ... on conflict do nothing.
-- Apply: SQL editor hoặc `npx supabase db push`. Không cần sync types (chỉ dữ liệu).

insert into public.technical_part_groups (code, label, parent_code, sort_order) values
  ('NGU_KIM', 'Ngũ kim (bu lông, ốc vít, tán, pát)', 'HARDWARE', 41),
  ('SON_HC',  'Sơn & hoá chất',                      'HARDWARE', 42),
  ('DAY_DAN', 'Dây đan / mây / textilene',           'OTHER',    61)
on conflict (code) do nothing;
