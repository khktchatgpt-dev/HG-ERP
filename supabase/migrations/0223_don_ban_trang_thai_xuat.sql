-- Kinh doanh: trạng thái đơn bán theo XUẤT HÀNG THẬT (07/10/2026, chốt D4).
--
-- Máy trạng thái cũ: confirmed → lsx_pending → lsx_issued → in_production →
-- completed → delivered. Đo 07/10/2026: `in_production` = 0/53 đơn (chỉ bật khi
-- xưởng ghi sổ sản lượng — chưa ai ghi), còn 0 lần ghi xuất dù 5 lệnh đã xong.
-- Chốt: BỎ `in_production` (tiến độ xưởng bày bằng cột riêng từ lệnh), THÊM hai
-- trạng thái suy từ Σ đợt xuất (sales_order_shipments, 0120):
--   partially_shipped : đã có đợt xuất nhưng chưa đủ
--   shipped           : đã xuất đủ (tới dung sai qty_tolerance_pct)
-- Máy mới: confirmed → lsx_pending → lsx_issued → completed → partially_shipped
-- → shipped → delivered (+ cancelled). Xuất có thể ghi TRƯỚC khi lệnh hoàn thành
-- (lệnh gộp LAURA 16 đợt) nên partially_shipped đi được từ lsx_issued.
--
-- RLS: không đổi (sales_orders ENABLED, no policies từ 0013 — anon chặn, server
-- secret key bypass). Idempotent: drop/add constraint; update dòng in_production
-- (nếu có) về lsx_issued trước khi siết. Sau khi apply: "sync types".

update public.sales_orders set status = 'lsx_issued' where status = 'in_production';

alter table public.sales_orders
  drop constraint if exists sales_orders_status_check;
alter table public.sales_orders
  add constraint sales_orders_status_check
  check (status in ('confirmed', 'lsx_pending', 'lsx_issued', 'completed',
                    'partially_shipped', 'shipped', 'delivered', 'cancelled'));

-- Dòng đơn: cho phép MỘT SP NHIỀU DÒNG (chốt D2 — ART giao hai tuần). Không có
-- ràng buộc unique nào ở DB (chỉ zod), ghi lại ở đây để người đọc migration biết
-- schema zod đã bỏ refine "Sản phẩm bị trùng dòng" cùng ngày.
