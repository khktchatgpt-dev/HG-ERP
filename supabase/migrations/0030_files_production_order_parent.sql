-- Files: thêm parent production_order (đính kèm file gốc phiếu LSX).
--
-- 0016 đã thêm quote_id / sales_order_id / purchase_order_id. Còn thiếu
-- production_order_id để lưu file gốc Lệnh sản xuất (PDF/scan). Rebuild constraint
-- files_one_parent để bao cột mới (vẫn: tối đa 1 parent).
--
-- Đặt sau 0014 (production_orders). RLS: files đã ENABLED no-policy từ 0006.
-- Idempotent: add column / drop+add constraint if exists. Sau đó "sync types".

alter table public.files
  add column if not exists production_order_id uuid
    references public.production_orders(id) on delete cascade;

alter table public.files drop constraint if exists files_one_parent;
alter table public.files
  add constraint files_one_parent check (
    (case when task_id             is null then 0 else 1 end) +
    (case when comment_id          is null then 0 else 1 end) +
    (case when customer_id         is null then 0 else 1 end) +
    (case when invoice_id          is null then 0 else 1 end) +
    (case when product_id          is null then 0 else 1 end) +
    (case when quote_id            is null then 0 else 1 end) +
    (case when sales_order_id      is null then 0 else 1 end) +
    (case when purchase_order_id   is null then 0 else 1 end) +
    (case when production_order_id is null then 0 else 1 end) <= 1
  );

create index if not exists files_production_order_idx
  on public.files (production_order_id)
  where production_order_id is not null and deleted_at is null;
