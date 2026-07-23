-- 0081_notification_return_type.sql
-- Notifications: thêm loại cho trả hàng NCC (nghiệp vụ ⑤, đi cùng 0080):
--
--   wh_return : phiếu xuất trả NCC đã tạo — báo GĐ/QL (ảnh hưởng tiến độ vật tư,
--               PO received có thể quay lại partial chờ NCC giao bù).
--
-- Mở rộng như 0020/0033/0066: drop + re-add check (dữ liệu cũ an toàn).
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
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));
