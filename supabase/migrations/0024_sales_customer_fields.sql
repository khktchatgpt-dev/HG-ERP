-- Kinh doanh: bổ sung trường hồ sơ khách hàng cho bán B2B xuất khẩu.
--
-- sales_customers thêm các trường phục vụ mẫu Sale Contract / Quotation
-- (FOB Quy Nhon, KH nước ngoài) và auto-fill điều khoản khi lập báo giá:
--   - tax_code             : mã số thuế / VAT (in trên hợp đồng)
--   - country              : quốc gia KH
--   - contact_person       : người liên hệ (email/phone hiện là của công ty)
--   - default_currency     : tiền tệ mặc định (auto-fill báo giá) — char(3)
--   - default_price_term   : điều kiện giá mặc định (vd 'FOB Quy Nhon')
--   - default_payment_terms: điều khoản thanh toán mặc định (vd 'L/C at sight')
--   - port_of_discharge    : cảng đích (tuỳ chọn, in trên hợp đồng)
--
-- RLS: không đổi (sales_customers đã ENABLED, no policies từ 0005).
-- Idempotent: add column if not exists — chạy lại an toàn. Non-destructive.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

alter table public.sales_customers
  add column if not exists tax_code             text,
  add column if not exists country              text,
  add column if not exists contact_person       text,
  add column if not exists default_currency     char(3),
  add column if not exists default_price_term    text,
  add column if not exists default_payment_terms text,
  add column if not exists port_of_discharge    text;
