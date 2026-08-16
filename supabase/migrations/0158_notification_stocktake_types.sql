-- 0158 — Notifications: 3 type cho vòng duyệt kiểm kê (0157).
--
--   wh_stocktake_pending  : biên bản mới lập, chờ duyệt — báo quản lý Kho.
--   wh_stocktake_approved : đã duyệt-áp — báo người lập.
--   wh_stocktake_rejected : bị từ chối kèm lý do — báo người lập.
--
-- Mở rộng như 0081/0155: drop + re-add check (dữ liệu cũ an toàn). Idempotent.
-- (lsx_revised / lsx_orders_changed vẫn thiếu — việc riêng đã ghi, không gộp.)

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low','wh_return',
                  'wh_stocktake_pending','wh_stocktake_approved','wh_stocktake_rejected',
                  'po_submitted','po_approved','po_rejected',
                  'po_withdrawn','po_reassigned','po_closed_short',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));
