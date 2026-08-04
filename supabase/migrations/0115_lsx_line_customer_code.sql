-- Dòng lệnh sản xuất: thêm MÃ KHÁCH (0115).
--
-- Form phiếu LSX chuẩn hoá 04/08/2026 in CẢ HAI mã trên cùng một dòng:
--   · `product_code`        — mã HG của nhà máy (xưởng, kho, định mức dùng);
--   · `customer_item_code`  — mã khách đặt (21600-217, 1700575.11, H23-S203…),
--     là thứ khách và chứng từ xuất hàng gọi.
-- Trước đây mỗi khách một mẫu phiếu nên chỉ in một trong hai; gộp về một form
-- chung thì phải có chỗ chứa cả hai, không thể nhét mã khách vào `product_code`.
--
-- Nạp từ đơn: lấy sẵn `technical_products.customer_item_code`; Sales sửa được ở
-- màn soạn dòng vì hàng đặt lại theo mùa hay đổi mã.
--
-- RLS: không tạo bảng mới → không đổi tư thế. Idempotent: add column if not exists.

alter table public.production_order_lines
  add column if not exists customer_item_code text;

comment on column public.production_order_lines.customer_item_code is
  'Mã SP theo cách gọi của khách (0115) — in cạnh mã HG trên phiếu LSX chuẩn.';
