-- 0052_drop_redundant_default_incoterm.sql
-- Dọn cột thừa: 0051 thêm default_incoterm nhưng sales_customers ĐÃ CÓ
-- default_price_term (chính là incoterm mặc định, vd 'FOB Quy Nhon') từ trước.
-- Cột vừa thêm, chưa code nào đọc/ghi — drop an toàn. default_payment_terms
-- trong 0051 vốn đã tồn tại nên add-if-not-exists là no-op.
-- Không đổi RLS. Idempotent: drop column if exists.

alter table sales_customers drop column if exists default_incoterm;
