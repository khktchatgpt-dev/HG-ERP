-- 0050_quote_line_discount.sql
-- Chiết khấu % theo DÒNG báo giá (Sales P3 — bàn chào giá):
--   thành tiền dòng = qty × unit_price × (1 − discount_pct/100).
-- NULL = không chiết khấu. Chỉ thêm cột — không đổi RLS: sales_quote_lines đã
-- `enable row level security` không policy từ 0031 (anon bị chặn, secret-key bypass).
-- Idempotent: add column if not exists.

alter table sales_quote_lines
  add column if not exists discount_pct numeric(5, 2)
    check (discount_pct is null or (discount_pct >= 0 and discount_pct <= 100));
