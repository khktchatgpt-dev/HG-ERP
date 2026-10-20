-- 0237 — Loại thông báo cho ĐỀ NGHỊ MUA VẬT TƯ (0236 · Đ2 lãnh đạo duyệt, 13/10/2026).
--
--   dnm_submitted — Kho gửi phiếu → báo người duyệt (quyền supply.po.approve + admin).
--   dnm_approved  — lãnh đạo duyệt → báo người đề nghị + trưởng phòng Cung ứng.
--   dnm_rejected  — lãnh đạo từ chối (kèm lý do) → báo người đề nghị.
--
-- Chỉ đổi danh sách loại của ràng buộc `notifications_type_check`: giữ NGUYÊN mọi
-- loại đang có trên DB (đọc pg_get_constraintdef 13/10, sau 0231) + thêm 3 loại.
-- Không bảng mới, không cột mới.
--
-- RLS: không đổi — `notifications` đã bật RLS không policy (anon bị chặn, khoá bí
-- mật của server đi qua). Idempotent: drop if exists rồi add lại. Chưa áp thì
-- handler gửi thông báo lỗi ràng buộc, bus nuốt lỗi — phiếu VẪN đổi trạng thái.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low','wh_return','wh_doc_reversed',
                  'wh_stocktake_pending','wh_stocktake_approved','wh_stocktake_rejected',
                  'po_submitted','po_approved','po_rejected',
                  'po_withdrawn','po_reopened','po_reassigned','po_closed_short','po_late',
                  'po_adjusted',
                  'po_unapproved','po_question','po_answered','po_urgent_sent',
                  'po_issue',
                  'dnm_submitted','dnm_approved','dnm_rejected',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'lsx_orders_changed','lsx_revised',
                  'lsx_cancelled','lsx_header_changed',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));
