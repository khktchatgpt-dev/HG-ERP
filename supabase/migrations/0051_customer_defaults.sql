-- 0051_customer_defaults.sql
-- Điều khoản mặc định theo KHÁCH (Sales P4 — Khách hàng 360):
--   default_incoterm / default_payment_terms — tự điền khi lập báo giá / đơn
--   cho khách đó (sửa được từng chứng từ, đây chỉ là giá trị gợi ý ban đầu).
-- Chỉ thêm cột — không đổi RLS: sales_customers đã `enable row level security`
-- không policy (anon bị chặn, secret-key bypass). Idempotent.

alter table sales_customers
  add column if not exists default_incoterm text,
  add column if not exists default_payment_terms text;
