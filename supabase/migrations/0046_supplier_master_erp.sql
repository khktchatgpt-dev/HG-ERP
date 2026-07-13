-- Vendor Master chuẩn ERP sản xuất (M1) — mở rộng hồ sơ NCC.
--
-- Bổ sung master-data cho supply_suppliers: pháp lý, thanh toán, mua hàng,
-- phân loại, admin. Giữ nguyên `is_active` (cổng chọn NCC khi tạo PO) + thêm
-- `status` 3 mức (active/suspended/terminated) đồng bộ ở tầng service.
-- Người liên hệ nhiều (supplier_contacts), chứng chỉ, đánh giá KPI = migration sau (M2/M3/M5).
--
-- Tất cả cột mới NULLABLE (add if not exists) → an toàn với dữ liệu cũ.
-- RLS: kế thừa (bảng đã ENABLED, no policies). Idempotent — chạy lại an toàn.

alter table public.supply_suppliers
  -- 1. Cơ bản
  add column if not exists short_name         text,
  add column if not exists type               text,   -- Nguyên vật liệu / Bao bì / Máy móc / Dịch vụ / Logistics / Khác
  add column if not exists status             text not null default 'active',
  -- 2. Pháp lý
  add column if not exists company_name        text,
  add column if not exists business_license    text,
  add column if not exists founded_on          date,
  add column if not exists legal_rep           text,
  add column if not exists country             text,
  add column if not exists registered_address  text,
  -- 3. Liên hệ (địa chỉ mở rộng; nhiều người liên hệ = supplier_contacts sau)
  add column if not exists trading_address     text,
  add column if not exists warehouse_address   text,
  add column if not exists website             text,
  -- 4. Thanh toán
  add column if not exists payment_terms       text,   -- COD / NET30 / NET45 / NET60…
  add column if not exists currency            char(3),
  add column if not exists bank_name           text,
  add column if not exists bank_account        text,
  add column if not exists swift_code          text,
  add column if not exists invoice_terms       text,
  -- 5. Mua hàng
  add column if not exists moq                 text,   -- mô tả (MOQ khác nhau theo mặt hàng)
  add column if not exists lead_time_days      int,
  add column if not exists incoterms           text,   -- EXW / FOB / CIF…
  add column if not exists delivery_method     text,
  add column if not exists return_policy       text,
  add column if not exists warranty_policy     text,
  -- Phân loại
  add column if not exists region              text,   -- Việt Nam / Trung Quốc / Nhật Bản…
  add column if not exists import_export       text,   -- domestic / import
  add column if not exists priority            text,   -- primary / backup (hoặc strategic/regular/occasional)
  add column if not exists rating              text,   -- A / B / C / D (M5 sẽ tính; nhập tay tạm)
  -- Admin
  add column if not exists buyer_id            uuid references public.users(id) on delete set null,
  add column if not exists can_order           boolean not null default true,
  add column if not exists lock_reason         text,
  add column if not exists created_by          uuid references public.users(id) on delete set null,
  add column if not exists updated_by          uuid references public.users(id) on delete set null;

-- status 3 mức + backfill từ is_active (NCC đang ngừng → suspended).
update public.supply_suppliers set status = 'suspended' where is_active = false;
alter table public.supply_suppliers drop constraint if exists supply_suppliers_status_check;
alter table public.supply_suppliers
  add constraint supply_suppliers_status_check
  check (status in ('active', 'suspended', 'terminated'));

create index if not exists supply_suppliers_status_idx on public.supply_suppliers (status);
create index if not exists supply_suppliers_type_idx on public.supply_suppliers (type);
