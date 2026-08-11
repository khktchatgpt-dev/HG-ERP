-- 0133 — Tách "PO mở" của bảng Theo dõi đơn hàng thành hai con số đúng nghĩa.
--
-- VẤN ĐỀ: `v_order_tracking.pos_open` đếm `status not in ('received','cancelled')`
-- — tức GỘP CẢ đơn còn NHÁP và đơn đang CHỜ GIÁM ĐỐC DUYỆT. Màn Theo dõi đơn
-- hàng hiển thị con số đó dưới nhãn "Vật tư (PO mở) · N PO chờ", nên người bán
-- đọc thành "vật tư đang trên đường về" trong khi thực tế chưa ai gửi đơn cho
-- nhà cung cấp. Sai lệch này im lặng và luôn nghiêng về phía lạc quan — đúng
-- hướng nguy hiểm khi đang hẹn ngày giao với khách.
--
-- SỬA: giữ tên `pos_open` nhưng thu về ĐÚNG nghĩa "đã duyệt, chưa về đủ"
-- (khớp `PO_OPEN_STATUSES` bên TypeScript — `src/lib/po-status.ts`), và thêm
-- `pos_unsent` cho phần "chưa gửi NCC" (nháp + chờ duyệt). Hai con số nói hai
-- việc khác nhau và cần hai hành động khác nhau: một cái là giục NCC, cái kia
-- là giục chính mình.
--
-- RLS: view khai `security_invoker = on` → thừa hưởng RLS của bảng gốc; bảng
-- nền đã bật RLS không policy nên anon bị chặn, secret key bypass như cũ.
--
-- CAVEAT: `create or replace view` KHÔNG thêm được cột vào giữa/cuối danh sách
-- của view đang tồn tại, nên phải drop rồi tạo lại. Không view nào khác phụ
-- thuộc `v_order_tracking` (đã rà: chỉ `productionRepo.listTracking()` đọc).
-- Phần thân view giữ NGUYÊN từ 0113 — chỉ hai dòng đếm PO là đổi.

drop view if exists public.v_order_tracking;

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
     join public.sales_order_lines ol on ol.id = j.order_line_id
    where j.production_order_id = po.id
      and ol.order_id = o.id)                                 as jobs_total,
  (select count(*)
     from public.production_jobs j
     join public.sales_order_lines ol on ol.id = j.order_line_id
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
  o.updated_at
from public.sales_orders o
join public.sales_customers c on c.id = o.customer_id
left join public.sales_quotes q on q.id = o.quote_id
left join public.production_orders po on po.id = o.production_order_id;
