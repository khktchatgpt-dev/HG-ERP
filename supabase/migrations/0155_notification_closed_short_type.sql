-- 0155 — Notifications: thêm type cho CHỐT PHẦN THIẾU (0154) + VÁ 2 type 0128
-- đang thiếu trong check constraint.
--
--   po_closed_short : Cung ứng chốt "phần thiếu không giao nữa" — báo Kho ngừng
--                     chờ hàng + GĐ/QL nắm (đơn có thể nhảy 'received' thiếu).
--   po_withdrawn    : VÁ — handler po.notifications (0128) đã insert type này
--   po_reassigned     từ 13/08 nhưng constraint chưa có → insert fail bị event
--                     bus nuốt im lặng, người duyệt/người nhận bàn giao KHÔNG
--                     nhận được thông báo. Thêm vào danh sách là hết.
--
-- Mở rộng như 0020/0033/0066/0081: drop + re-add check (dữ liệu cũ an toàn).
-- RLS: không đổi. Idempotent.

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low','wh_return',
                  'po_submitted','po_approved','po_rejected',
                  'po_withdrawn','po_reassigned','po_closed_short',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));
