-- Notifications: thêm loại cho luồng duyệt đơn đặt vật tư (BR-05, FR-ADM-03).
--
-- po_submitted: PO mới chờ GĐ duyệt · po_approved / po_rejected: báo người lập.
-- Cách mở rộng như 0018/0019: drop + re-add check constraint (dữ liệu cũ an toàn).
--
-- RLS: không đổi posture. Apply: `npx supabase db push` hoặc SQL editor.

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low',
                  'po_submitted','po_approved','po_rejected'));
