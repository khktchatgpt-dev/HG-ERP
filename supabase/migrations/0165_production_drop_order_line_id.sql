-- 0165: Dọn nợ 0114 — bỏ cột trỏ dòng-đơn kiểu cũ trên production_jobs /
-- production_components (BỎ DÙNG từ 0114, thay bằng production_order_line_id
-- trỏ production_order_lines) + drop bảng production_order_line_specs cũ.
--
-- KÉO THEO: v_order_tracking (0148) đang join `j.order_line_id` nên chặn drop.
-- Dựng lại view với join mới qua production_order_lines → sales_order_line_id.
-- TIỆN THỂ SỬA BUG TIỀM ẨN: từ 0114 jobs không còn ghi order_line_id, nên
-- jobs_total/jobs_done của view đếm 0 với mọi job tạo sau 0114 — join mới đếm
-- đúng trở lại. Dòng lệnh không gắn dòng đơn (sales_order_line_id null) không
-- vào đếm — đúng nghĩa "việc của ĐƠN này".
--
-- Đã kiểm remote 23/08/2026: production_jobs / production_components /
-- production_order_line_specs đều RỖNG — không cần backfill.
-- RLS: view giữ security_invoker = on; bảng không đổi tư thế (chỉ drop).
-- Idempotent: drop if exists + create view.

drop view if exists public.v_order_tracking;

alter table production_jobs       drop column if exists order_line_id;
alter table production_components drop column if exists order_line_id;
drop table if exists production_order_line_specs;

create view public.v_order_tracking with (security_invoker = on) as
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
  po.priority      as lsx_priority,
  po.ship_date,
  (select count(*)
     from public.production_jobs j
     join public.production_order_lines pol on pol.id = j.production_order_line_id
     join public.sales_order_lines ol on ol.id = pol.sales_order_line_id
    where j.production_order_id = po.id
      and ol.order_id = o.id)                                 as jobs_total,
  (select count(*)
     from public.production_jobs j
     join public.production_order_lines pol on pol.id = j.production_order_line_id
     join public.sales_order_lines ol on ol.id = pol.sales_order_line_id
    where j.production_order_id = po.id
      and ol.order_id = o.id
      and j.status = 'done')                                  as jobs_done,
  (select count(*)
     from public.sales_order_lines ol
     join public.technical_products p on p.id = ol.product_id
    where ol.order_id = o.id and p.bom_status <> 'done')      as lines_bom_pending,
  -- ĐÃ DUYỆT, CHƯA VỀ ĐỦ — vật tư thật sự đang trên đường.
  (select count(*)
     from public.supply_purchase_orders spo
    where spo.production_order_id = po.id
      and spo.status in
        ('approved', 'ordered', 'confirmed', 'in_transit', 'partial'))  as pos_open,
  -- CHƯA RA KHỎI NHÀ — nháp hoặc đang nằm bàn duyệt của Giám đốc.
  (select count(*)
     from public.supply_purchase_orders spo
    where spo.production_order_id = po.id
      and spo.status in ('draft', 'pending_approval'))        as pos_unsent,
  o.deposit_percent,
  o.payment_method,
  (select coalesce(sum(ol.qty * ol.unit_price), 0)
     from public.sales_order_lines ol
    where ol.order_id = o.id)                                 as order_value,
  (select count(*)
     from public.sales_order_lines ol
    where ol.order_id = o.id)                                 as line_count,
  o.created_at,
  o.updated_at,
  -- MỌI đơn mua của lệnh trừ đơn huỷ: 0 = chưa ai lập đơn mua nào (0148).
  (select count(*)
     from public.supply_purchase_orders spo
    where spo.production_order_id = po.id
      and spo.status <> 'cancelled')                          as pos_total,
  -- Kho xác nhận vật tư của lệnh đã về đủ (null = chưa) (0148).
  po.materials_received_at                                    as materials_received_at
from public.sales_orders o
join public.sales_customers c on c.id = o.customer_id
left join public.sales_quotes q on q.id = o.quote_id
left join public.production_orders po on po.id = o.production_order_id;

comment on view public.v_order_tracking is
  'Theo dõi đơn hàng: lớp thương mại + tiến độ lệnh/vật tư. pos_total & materials_received_at (0148) để suy ĐƯỢC bậc tắc — xem src/lib/order-gate.ts. jobs_* join qua production_order_lines từ 0165.';
