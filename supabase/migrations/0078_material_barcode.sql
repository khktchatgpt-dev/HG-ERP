-- 0078_material_barcode.sql — Barcode nhẹ trên vật tư (bước 4 định hướng lại Kho)
--
-- warehouse_materials.barcode: mã vạch CÓ SẴN của NCC (EAN trên phụ kiện, sơn,
-- vật tư mua ngoài) — quét ở ô ScanInput khớp cả code lẫn barcode (FR-WMS-09,
-- máy scan = bàn phím). KHÔNG in tem, KHÔNG truy xuất lô/serial, KHÔNG QR —
-- giữ đúng quyết định cũ (0045: không theo dõi lô vật lý; QR/backflushing bỏ).
--
-- Unique partial index: 2 vật tư không được trùng barcode (tra 1 phát ra đúng
-- 1 vật tư); NULL thoải mái (đa số vật tư khối ống/tấm không có mã vạch).
--
-- RLS: không đổi (bảng đã enable RLS, no policies). Idempotent.

alter table public.warehouse_materials
  add column if not exists barcode text;

create unique index if not exists warehouse_materials_barcode_key
  on public.warehouse_materials (barcode)
  where barcode is not null;

comment on column public.warehouse_materials.barcode is
  'Mã vạch sẵn có của NCC (EAN…) — ScanInput khớp cả code lẫn barcode (0078). Không in tem/lô/QR.';
