-- Notifications: thêm loại thông báo cho luồng duyệt báo giá (FR-SAL-03).
--
-- Bảng notifications (0002) có check constraint khoá `type` theo nghiệp vụ task.
-- Sprint Sales cần 3 loại mới: quote_submitted (gửi GĐ duyệt), quote_approved /
-- quote_rejected (báo người lập). Drop + re-add constraint là cách duy nhất mở
-- rộng check; dữ liệu cũ không bị ảnh hưởng (tập giá trị chỉ rộng ra).
--
-- RLS: không đổi posture (bảng đã enable no-policy từ 0002).
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types" (không đổi cột).

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected'));
