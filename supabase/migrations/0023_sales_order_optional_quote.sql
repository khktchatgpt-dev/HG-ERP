-- Đơn hàng KHÔNG bắt buộc gắn báo giá.
--
-- Trước: sales_orders.quote_id NOT NULL (đơn phải sinh từ báo giá). Nay sale
-- được tạo đơn trực tiếp (nhập khách + dòng SP) để lưu và làm mốc phát LSX, nên
-- quote_id cho phép NULL. Nhánh "từ báo giá" vẫn giữ (service snapshot dòng SP).
--
-- FK vẫn còn (on delete restrict) — chỉ nới NOT NULL. sales_orders đang TRỐNG
-- nên không cần backfill. RLS không đổi (ENABLED, no policies từ 0013).
-- Idempotent: drop not null trên cột đã nullable là no-op an toàn.

alter table public.sales_orders
  alter column quote_id drop not null;
