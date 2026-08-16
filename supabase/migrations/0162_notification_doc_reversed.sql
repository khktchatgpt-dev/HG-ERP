-- 0162 — Notifications: type cho PHIẾU ĐẢO (0161/K1).
--
--   wh_doc_reversed : có người đảo phiếu ghi sai — báo quản lý Kho (+ người
--                     phụ trách đơn nếu phiếu gốc theo PO) để nắm sổ vừa lùi.
--
-- Mở rộng như 0081/0155/0158/0159: drop + re-add check. Idempotent.

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low','wh_return','wh_doc_reversed',
                  'wh_stocktake_pending','wh_stocktake_approved','wh_stocktake_rejected',
                  'po_submitted','po_approved','po_rejected',
                  'po_withdrawn','po_reassigned','po_closed_short','po_late',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));
