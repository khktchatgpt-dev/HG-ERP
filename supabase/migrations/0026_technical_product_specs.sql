-- Kỹ thuật: bổ sung thông số kỹ thuật sản phẩm phục vụ in Lệnh sản xuất + Hợp đồng.
--
-- Từ 3 mẫu chứng từ thật (xem docs/plan-erp-documents.md):
--   - LSX cần: tên tiếng Đức, nội dung shipping mark, barcode, mẫu tại showroom,
--     và thông số SX (máy / nệm / sơn / kính / gỗ) → gom vào jsonb tech_spec.
--   - Báo giá cần: giá tham khảo nội bộ (reference_price).
--   - Nhãn đơn vị đóng gói (ctn/pallet) nằm trong jsonb `packing` (không cột riêng).
--
-- tech_spec (jsonb) = { machine, cushion, paint, glass, wood } — mặc định của SP;
-- đợt 2 sẽ cho ghi đè ở dòng LSX nếu cùng mã SP khác thông số theo lệnh (OI-A).
--
-- RLS: không đổi (technical_products đã ENABLED, no policies từ 0012).
-- Idempotent: add column if not exists — non-destructive, chạy lại an toàn.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

alter table public.technical_products
  add column if not exists name_de         text,
  add column if not exists shipping_mark   text,
  add column if not exists barcode         text,
  add column if not exists showroom_sample boolean not null default false,
  add column if not exists reference_price numeric(18, 2),
  add column if not exists tech_spec       jsonb not null default '{}'::jsonb;

-- Tra cứu nhanh theo barcode khi có (không unique — cùng barcode có thể tái dùng).
create index if not exists technical_products_barcode_idx
  on public.technical_products (barcode) where barcode is not null;
