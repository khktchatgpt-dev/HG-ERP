-- 0148 — Thêm 2 tín hiệu vào v_order_tracking để biết ĐƠN ĐANG TẮC Ở ĐÂU.
--
-- VẤN ĐỀ: sau khi lệnh được Giám đốc ký, mọi đơn đều rơi vào cùng một nhãn
-- "Chuẩn bị sản xuất 15%" (src/lib/order-progress.ts). Đo thật ngày 15/08/2026:
-- CẢ 20/20 đơn đang mở đều hiện đúng một dòng chữ đó — màn quản lý đơn hàng của
-- Giám đốc nói được đúng một câu vô dụng, trong khi thực tế chúng tắc ở những
-- khâu khác nhau và do những phòng khác nhau giữ.
--
-- Muốn tách được các bậc sau khi ký lệnh (chốt định mức → lập đơn mua → gửi NCC
-- → vật tư về → lên kế hoạch SX → sản xuất), view còn thiếu hai thứ:
--
--   · `pos_total` — TỔNG số đơn mua của lệnh (trừ đơn đã huỷ). Không có nó thì
--     `pos_open = 0` mang hai nghĩa trái ngược nhau mà không phân biệt được:
--     "chưa lập đơn mua nào" hay "đơn mua đã về đủ hết rồi". Đoán nhầm vế nào
--     cũng ra lời khuyên sai cho Giám đốc.
--   · `materials_received_at` — mốc Kho xác nhận vật tư của lệnh đã về đủ. Đây
--     là câu trả lời dứt khoát cho vế trên, không phải suy diễn từ số đếm PO.
--
-- KHÔNG đổi cột nào đang có; chỉ thêm hai cột ở cuối. Phần thân giữ nguyên từ
-- 0133 (đang là bản mới nhất).
--
-- RLS: view khai `security_invoker = on` → thừa hưởng RLS của bảng gốc; bảng nền
-- bật RLS không policy nên anon bị chặn, secret key bypass như cũ.
--
-- CAVEAT: `create or replace view` không thêm được cột vào view đang tồn tại →
-- phải drop rồi tạo lại. Đã rà: chỉ `productionRepo.listTracking()` đọc view
-- này, không view nào khác phụ thuộc.
--
-- Idempotent: drop if exists + create.

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
  o.updated_at,
  -- 0148 ── hai tín hiệu mới ────────────────────────────────────────────────
  -- MỌI đơn mua của lệnh trừ đơn huỷ: 0 = chưa ai lập đơn mua nào.
  (select count(*)
     from public.supply_purchase_orders spo
    where spo.production_order_id = po.id
      and spo.status <> 'cancelled')                          as pos_total,
  -- Kho xác nhận vật tư của lệnh đã về đủ (null = chưa).
  po.materials_received_at                                    as materials_received_at
from public.sales_orders o
join public.sales_customers c on c.id = o.customer_id
left join public.sales_quotes q on q.id = o.quote_id
left join public.production_orders po on po.id = o.production_order_id;

comment on view public.v_order_tracking is
  'Theo dõi đơn hàng: lớp thương mại + tiến độ lệnh/vật tư. pos_total & materials_received_at (0148) để suy ĐƯỢC bậc tắc — xem src/lib/order-gate.ts.';
