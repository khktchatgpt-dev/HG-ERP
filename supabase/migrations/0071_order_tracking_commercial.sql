-- Ban Giám đốc — QUẢN LÝ ĐƠN HÀNG: bổ sung lớp THƯƠNG MẠI vào v_order_tracking.
--
-- Màn /exec/orders (GĐ) cần nhìn đơn theo TIỀN song song với tiến độ sản xuất:
-- giá trị đơn (Σ qty×đơn giá bán), số dòng SP, % cọc, phương thức thanh toán.
-- Trước đây view chỉ có trạng thái/tiến độ (FR-SAL-07) — thiếu tiền nên GĐ không
-- đánh giá được "sổ đơn" hay công nợ. Bổ sung 4 cột, giữ nguyên phần cũ.
--
-- `create or replace view` = idempotent; giữ `security_invoker = on` (view kế
-- thừa RLS của caller — anon bị chặn, server secret key bypass như bảng gốc).
-- Apply: `npx supabase db push` / SQL editor. Sau đó "sync types".

create or replace view public.v_order_tracking with (security_invoker = on) as
select
  o.id,
  o.code,
  o.customer_id,
  c.name           as customer_name,
  o.customer_po_no,
  o.status,
  o.currency,
  o.due_date,
  q.code           as quote_code,
  po.id            as production_order_id,
  po.code          as lsx_code,
  po.status        as lsx_status,
  po.current_stage,
  po.ship_date,
  (select count(*)
     from public.sales_order_lines ol
     join public.technical_products p on p.id = ol.product_id
    where ol.order_id = o.id and p.bom_status <> 'done')      as lines_bom_pending,
  (select count(*)
     from public.supply_purchase_orders spo
    where spo.production_order_id = po.id
      and spo.status not in ('received', 'cancelled'))        as pos_open,
  -- ── Lớp thương mại (mới) ─────────────────────────────────────────────────
  o.deposit_percent,
  o.payment_method,
  (select coalesce(sum(ol.qty * ol.unit_price), 0)
     from public.sales_order_lines ol
    where ol.order_id = o.id)                                 as order_value,
  (select count(*)
     from public.sales_order_lines ol
    where ol.order_id = o.id)                                 as line_count,
  o.created_at,
  o.updated_at
from public.sales_orders o
join public.sales_customers c on c.id = o.customer_id
left join public.sales_quotes q on q.id = o.quote_id
left join public.production_orders po on po.sales_order_id = o.id;
