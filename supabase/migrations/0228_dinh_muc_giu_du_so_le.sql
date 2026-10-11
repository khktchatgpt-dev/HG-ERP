-- 0228 — Giữ ĐỦ số lẻ cho số dẫn xuất định mức (10/10/2026).
--
-- Vì sao: nạp BOM bộ sofa nhôm GIGA (file S0047HG-AL), user chốt "ghi đúng số
-- không chỉnh sửa". Số trên tờ Excel có tới 8 số lẻ (vd. Tay vịn 1,3913856 kg,
-- Khối lượng khung 14,70017376 kg) nhưng cột cắt bớt: kg dòng 6 lẻ, kg khung
-- 3 lẻ, diện tích sơn hồ sơ 4 lẻ. Đổi sang `numeric` KHÔNG giới hạn để giữ
-- nguyên văn số của file; hiển thị vẫn do tầng giao diện làm tròn.
--
-- Đổi (precision, scale) → numeric trơn là NỚI RỘNG: Postgres không ghi lại
-- bảng, dữ liệu cũ giữ nguyên giá trị. Không view nào phụ thuộc các cột này
-- (đã soát pg_depend 10/10/2026). Chạy lại vô hại.
--
-- RLS: không đổi — hai bảng vẫn ENABLE RLS, không policy (anon bị chặn, khoá
-- secret của server đi qua).
--
-- Apply: MCP apply_migration hoặc `npx supabase db push`. Types không đổi
-- (numeric vẫn là `number`).

alter table public.technical_product_parts
  alter column weight_kg type numeric,
  alter column total_length_m type numeric,
  alter column paint_area_m2 type numeric;

alter table public.technical_products
  alter column frame_weight_kg type numeric,
  alter column frame_length_m type numeric,
  alter column paint_area_m2 type numeric,
  alter column actual_weight_kg type numeric;
