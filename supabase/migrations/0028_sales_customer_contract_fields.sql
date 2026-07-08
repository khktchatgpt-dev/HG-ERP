-- Kinh doanh: thêm trường bên mua cho hợp đồng (Sales Contract).
--
-- Bổ sung sales_customers:
--   - fax                 : số fax (in trên hợp đồng)
--   - representative_title : chức danh người đại diện (đi kèm contact_person)
--   - fsc_cert            : mã chứng nhận FSC của khách (Buyer FSC Cert.)
--
-- RLS: không đổi (sales_customers đã ENABLED, no policies từ 0005).
-- Idempotent: add column if not exists — non-destructive. Sau đó "sync types".

alter table public.sales_customers
  add column if not exists fax                 text,
  add column if not exists representative_title text,
  add column if not exists fsc_cert            text;
