-- Notifications: thêm loại thông báo cho nghiệp vụ Kho (FR-WMS-08 + hàng về).
--
-- wh_receipt: phiếu nhập đã tạo (Cung ứng/BQL biết hàng về — đặc tả 4.4 liên kết
-- Kho↔Cung ứng 2 chiều). wh_stock_low: tồn rơi xuống dưới mức tối thiểu sau khi
-- xuất → đề xuất mua. Cách mở rộng giống 0018: drop + re-add check constraint.
--
-- RLS: không đổi posture. Apply: `npx supabase db push` hoặc SQL editor.

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low'));
