-- ĐỘ DÀY sản phẩm (mm) — mục 5 tài liệu liệt kê Thickness cạnh L/W/H.
--
-- Hồ sơ đang có ba cột mm (dài/rộng/cao, 0129) + bộ mở/gấp (0104) nhưng không có
-- độ dày. Với nội thất xuất khẩu đây là số hay bị khách hỏi: dày mặt bàn, dày
-- tấm polywood, dày kính. Nằm cùng nhóm với ba cột kia nên làm CỘT THẬT chứ
-- không nhét vào jsonb `tech_spec` — cùng đơn vị, cùng nguồn, cùng chỗ sửa.
--
-- Không đụng `technical_product_parts.wall_thickness_mm`: đó là độ dày THÀNH ỐNG
-- của từng chi tiết trong định mức, khác hẳn độ dày của sản phẩm.
--
-- RLS: technical_products đã enable RLS no-policies từ 0012 — thêm cột không đổi
-- tư thế. Idempotent.

alter table public.technical_products
  add column if not exists thickness_mm numeric;

comment on column public.technical_products.thickness_mm is
  'Độ dày sản phẩm (mm) — mặt bàn / tấm / kính. Khác wall_thickness_mm của dòng định mức';
