-- Files: thêm parent mới cho chuỗi ERP (NFR-03, BR-11 — file gắn đúng đối tượng).
--
-- Mở rộng polymorphic parent của public.files: quote_id / sales_order_id /
-- purchase_order_id (chứng từ báo giá, hợp đồng bán, hồ sơ mua hàng — FR-SUP-07).
-- Bản vẽ/BOM/ảnh SP đã có qua product_id (0006). Constraint files_one_parent
-- được dựng lại để bao các cột mới (vẫn: tối đa 1 parent).
--
-- Đặt sau 0013/0015 vì FK trỏ tới sales_quotes/sales_orders/supply_purchase_orders.
-- RLS: bảng files đã ENABLED no-policy từ 0006 — không đổi posture.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

alter table public.files
  add column if not exists quote_id uuid
    references public.sales_quotes(id) on delete cascade;
alter table public.files
  add column if not exists sales_order_id uuid
    references public.sales_orders(id) on delete cascade;
alter table public.files
  add column if not exists purchase_order_id uuid
    references public.supply_purchase_orders(id) on delete cascade;

alter table public.files drop constraint if exists files_one_parent;
alter table public.files
  add constraint files_one_parent check (
    (case when task_id           is null then 0 else 1 end) +
    (case when comment_id        is null then 0 else 1 end) +
    (case when customer_id       is null then 0 else 1 end) +
    (case when invoice_id        is null then 0 else 1 end) +
    (case when product_id        is null then 0 else 1 end) +
    (case when quote_id          is null then 0 else 1 end) +
    (case when sales_order_id    is null then 0 else 1 end) +
    (case when purchase_order_id is null then 0 else 1 end) <= 1
  );

create index if not exists files_quote_idx
  on public.files (quote_id) where quote_id is not null and deleted_at is null;
create index if not exists files_sales_order_idx
  on public.files (sales_order_id) where sales_order_id is not null and deleted_at is null;
create index if not exists files_purchase_order_idx
  on public.files (purchase_order_id) where purchase_order_id is not null and deleted_at is null;
