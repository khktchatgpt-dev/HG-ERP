-- Notifications: thêm loại cho luồng duyệt Lệnh sản xuất (FR-SAL-06).
--
-- lsx_submitted: LSX mới chờ GĐ duyệt · lsx_approved / lsx_rejected: báo người phát.
-- Mở rộng như 0020: drop + re-add check (dữ liệu cũ an toàn).
-- RLS: không đổi. Apply: `npx supabase db push` hoặc SQL editor.

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low',
                  'po_submitted','po_approved','po_rejected',
                  'lsx_submitted','lsx_approved','lsx_rejected'));
