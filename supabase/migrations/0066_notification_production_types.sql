-- 0066_notification_production_types.sql
-- Notifications: thêm loại cho tách vai sản xuất (bàn giao công đoạn + sự cố)
-- và VÁ BUG: 0033 quên order_changed / order_cancelled dù code
-- (order.notifications.ts, đã có trong union TS) insert 2 loại này → vi phạm
-- check constraint lúc chạy. Danh sách dưới = 0033 + 2 loại bị quên + 3 loại mới:
--
--   stage_handoff      : tổ trước xong công đoạn → báo tổ kế tiếp + quản đốc.
--   incident_reported  : tổ báo sự cố → báo admin/manager.
--   incident_resolved  : quản đốc xử lý xong → báo người báo cáo.
--
-- Mở rộng như 0020/0033: drop + re-add check (dữ liệu cũ an toàn).
-- RLS: không đổi. Idempotent. Apply: `npx supabase db push`.

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low',
                  'po_submitted','po_approved','po_rejected',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));
