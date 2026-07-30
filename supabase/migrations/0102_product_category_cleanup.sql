-- DỌN CỘT `technical_products.category` (user chốt 30/07/2026).
--
-- Bối cảnh: hồ sơ SP có ô "Danh mục" GÕ TỰ DO, không dropdown, không ràng buộc.
-- Đối chiếu dữ liệu thật (537 SP):
--   · 528 SP để trống cột `category`
--   ·   9 SP có giá trị, và đều KHÔNG phải danh mục:
--       BUNNING(1) · MERXX(2) · ROSCO(1) · YOTRIO(4) → đúng là TÊN KHÁCH
--       Laura(1)                                     → tên BỘ/DÒNG sản phẩm
-- Tên khách thuộc cột `customer_name` ("Khách hàng / nhóm"), không phải danh mục.
-- Vì thế `product-meta.tsx` đã cố tình không đọc cột này và CSV export đã bỏ nó,
-- nhưng ô nhập vẫn còn trên form nên vẫn tiếp tục hứng dữ liệu sai.
--
-- Migration này KHÔNG đổi schema. Nó chỉ xoá những giá trị ĐÃ LẶP LẠI cột
-- `customer_name`, để `category` bắt đầu lại đúng nghĩa: MÃ danh mục trong
-- `catalog_items` (type = 'product_category'), chọn bằng select ở giao diện.
--
-- CỐ Ý KHÔNG xoá sạch: cả 9 SP đều đã có `customer_name`, nên không có gì cần
-- "chuyển sang" — nhưng `Laura` (ST0076HG-IR, khách AlphaMarts) là thông tin
-- THẬT và không nằm ở cột nào khác. Xoá nó là mất dữ liệu. Giao diện đã xử lý
-- được giá trị ngoài danh mục (hiện "Laura (ngoài danh mục)" trong dropdown, xem
-- `categoryOptions` ở product-sections.ts) nên để người dùng tự quyết: gán vào
-- một danh mục thật, hay chuyển sang ô khác.
--
-- Danh sách danh mục KHÔNG seed ở đây: đó là taxonomy của doanh nghiệp, admin tự
-- khai ở /admin/catalogs (loại "Danh mục sản phẩm"). Giao diện tự ẩn ô + bộ lọc
-- danh mục khi chưa có mục nào.
--
-- RLS: không tạo bảng/view mới. `technical_products` và `catalog_items` đã bật
-- RLS không policy từ migration gốc (anon bị chặn, secret key bypass) — giữ nguyên.
--
-- Idempotent: lệnh có WHERE nên chạy lại là no-op.

-- Xoá `category` khi nó chỉ là bản lặp/rút gọn của nhãn khách — so sánh không
-- phân biệt hoa thường, vì dữ liệu ghi "MERXX" ở cột này và "MERXX HANDELS GMBH"
-- ở cột kia. Khớp 8/9 dòng; dòng `Laura` được giữ lại có chủ đích (xem trên).
update public.technical_products
set category = null
where category is not null
  and customer_name is not null
  and (
    lower(btrim(customer_name)) like lower(btrim(category)) || '%'
    or lower(btrim(category)) like lower(btrim(customer_name)) || '%'
  );
