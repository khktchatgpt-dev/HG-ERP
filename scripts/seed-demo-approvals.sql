-- Dữ liệu mẫu cho khu Phê duyệt (buồng lái) — tất cả đánh dấu 'DEMO-' để xoá sạch.
-- Tạo: 4 đơn hàng → 4 LSX (2 chờ duyệt + 2 đã duyệt) → 4 PO chờ duyệt
-- (giá trị nhỏ / vừa / ≥50tr để thấy chặn duyệt nhanh; aging khác nhau).
-- Idempotent: xoá DEMO cũ trước rồi chèn lại. Chạy: dán vào SQL editor / execute_sql.
--
-- DỌN SẠCH (chạy riêng khi muốn gỡ):
--   delete from supply_purchase_order_lines where po_id in (select id from supply_purchase_orders where code like 'DEMO-%');
--   delete from supply_purchase_orders where code like 'DEMO-%';
--   delete from production_orders where code like 'DEMO-%';
--   delete from sales_orders where code like 'DEMO-%';

begin;

-- 0) Xoá DEMO cũ (idempotent)
delete from supply_purchase_order_lines where po_id in (select id from supply_purchase_orders where code like 'DEMO-%');
delete from supply_purchase_orders where code like 'DEMO-%';
delete from production_orders where code like 'DEMO-%';
delete from sales_orders where code like 'DEMO-%';

-- 1) Đơn hàng (confirmed)
insert into sales_orders (id, code, customer_id, status, currency, due_date, created_by, container_summary, created_at) values
 ('a0000000-0000-0000-0000-000000000001','DEMO-DH-01','907daf96-aace-4c60-a24d-93fe6b509e6c','confirmed','USD', now()::date + 30, '77b5c16b-56b8-46f2-b90d-9b96830624e3','1 × 40HC', now() - interval '8 days'),
 ('a0000000-0000-0000-0000-000000000002','DEMO-DH-02','3faf4ba5-2319-40eb-9624-3ab8a7774d54','confirmed','USD', now()::date + 40, 'e589c8de-66f5-48be-bf33-55bc2fa9fef9','1 × 40HC', now() - interval '9 days'),
 ('a0000000-0000-0000-0000-000000000003','DEMO-DH-03','907daf96-aace-4c60-a24d-93fe6b509e6c','confirmed','USD', now()::date + 25, '77b5c16b-56b8-46f2-b90d-9b96830624e3','2 × 40HC', now() - interval '10 days'),
 ('a0000000-0000-0000-0000-000000000004','DEMO-DH-04','25e66572-7295-4f6d-b018-1957f54f6ace','confirmed','USD', now()::date + 35, 'e589c8de-66f5-48be-bf33-55bc2fa9fef9','1 × 40HC', now() - interval '10 days');

-- 2) LSX — 2 chờ duyệt (aging 1 & 3 ngày) + 2 đã duyệt (để treo PO)
insert into production_orders (id, code, sales_order_id, status, issued_by, issued_at, ship_date, container_summary, approved_by, approved_at, created_at) values
 ('b0000000-0000-0000-0000-000000000001','DEMO-LSX-01','a0000000-0000-0000-0000-000000000001','pending_approval','77b5c16b-56b8-46f2-b90d-9b96830624e3', now() - interval '1 day', now()::date + 28,'1 × 40HC', null, null, now() - interval '1 day'),
 ('b0000000-0000-0000-0000-000000000002','DEMO-LSX-02','a0000000-0000-0000-0000-000000000002','pending_approval','e589c8de-66f5-48be-bf33-55bc2fa9fef9', now() - interval '3 days', now()::date + 38,'1 × 40HC', null, null, now() - interval '3 days'),
 ('b0000000-0000-0000-0000-000000000003','DEMO-LSX-03','a0000000-0000-0000-0000-000000000003','approved','77b5c16b-56b8-46f2-b90d-9b96830624e3', now() - interval '7 days', now()::date + 23,'2 × 40HC', '318878e4-07f4-4f74-b264-8fc88903aa0f', now() - interval '6 days', now() - interval '7 days'),
 ('b0000000-0000-0000-0000-000000000004','DEMO-LSX-04','a0000000-0000-0000-0000-000000000004','approved','e589c8de-66f5-48be-bf33-55bc2fa9fef9', now() - interval '7 days', now()::date + 33,'1 × 40HC', '318878e4-07f4-4f74-b264-8fc88903aa0f', now() - interval '6 days', now() - interval '7 days');

-- 3) PO chờ duyệt — created_by = NV Cung ứng Test; aging + giá trị khác nhau
insert into supply_purchase_orders (id, code, production_order_id, supplier_id, status, currency, expected_at, created_by, created_at) values
 ('c0000000-0000-0000-0000-000000000001','DEMO-PO-01','b0000000-0000-0000-0000-000000000003','dfc6c83c-1b72-4b53-adf9-ad774adadc2a','pending_approval','VND', now()::date + 14,'3a46a417-2f63-446f-8a31-f3fdb6b27ee0', now()),
 ('c0000000-0000-0000-0000-000000000002','DEMO-PO-02','b0000000-0000-0000-0000-000000000003','99339fa6-be28-4f57-8b47-fa899d7af8d4','pending_approval','VND', now()::date + 10,'3a46a417-2f63-446f-8a31-f3fdb6b27ee0', now() - interval '2 days'),
 ('c0000000-0000-0000-0000-000000000003','DEMO-PO-03','b0000000-0000-0000-0000-000000000004','a43c8ef0-ed1c-4b94-ad35-e87c3c15d09a','pending_approval','VND', now()::date + 12,'3a46a417-2f63-446f-8a31-f3fdb6b27ee0', now() - interval '5 days'),
 ('c0000000-0000-0000-0000-000000000004','DEMO-PO-04','b0000000-0000-0000-0000-000000000004','d2bf92cf-0d18-4d1d-adfb-c45da35bf538','pending_approval','VND', now()::date + 7,'3a46a417-2f63-446f-8a31-f3fdb6b27ee0', now());

-- 4) Dòng PO (unit_price × qty = tổng để thấy trên buồng lái)
insert into supply_purchase_order_lines (po_id, material_id, qty_ordered, unit_price, price_basis, sort_order) values
 -- PO-01 ~16,5tr (Ống nhôm)
 ('c0000000-0000-0000-0000-000000000001','7e9852f6-2a52-451b-a619-979936c1b2f9', 300, 55000, 'unit', 0),
 -- PO-02 ~32,5tr (Gỗ MDF)
 ('c0000000-0000-0000-0000-000000000002','34ac6133-cf90-4a3b-98fa-66cf984ddd4b', 250, 130000, 'unit', 0),
 -- PO-03 ~64tr — GIÁ TRỊ LỚN ≥50tr (Sắt hộp)
 ('c0000000-0000-0000-0000-000000000003','6bdcf043-5a8c-47eb-bc80-671b882b4fea', 2000, 32000, 'unit', 0),
 -- PO-04 ~10,2tr (Ray trượt + Ốc vít)
 ('c0000000-0000-0000-0000-000000000004','03f72c93-b0fe-49d5-867c-f5b7c1a9f1d2', 200, 45000, 'unit', 0),
 ('c0000000-0000-0000-0000-000000000004','034bfe05-7843-4e87-9ca3-5b66d1d747e0', 30, 40000, 'unit', 1);

commit;
