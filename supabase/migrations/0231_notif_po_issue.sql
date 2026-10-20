-- 0231 — Loại thông báo "po_issue": BÁO SỰ CỐ GIAO HÀNG của đơn mua (Kho đợt 2 · Bước 3, 12/10/2026).
--
-- Kho báo sự cố lúc nhận (kể cả từ chối nhận cả lô) vào sổ sự cố 0213
-- (`supply_po_issues`); người phụ trách đơn bên Cung ứng phải được BÁO — trước đây
-- sổ chỉ hiện khi mở hộp Giao nhận của đúng đơn đó. Loại có sẵn `incident_reported`
-- mang nhãn "báo sự cố xưởng" (sự cố công đoạn) — dùng lại là báo sai.
--
-- Chỉ đổi danh sách loại của ràng buộc `notifications_type_check` (giữ NGUYÊN mọi
-- loại của 0224, thêm 'po_issue'). Không bảng mới, không cột mới.
--
-- RLS: không đổi — `notifications` đã enable RLS không policy (anon bị chặn, khoá bí
-- mật của server đi qua).
--
-- Idempotent: drop if exists rồi add lại. Chưa áp migration này thì handler gửi
-- thông báo lỗi ràng buộc và bus sự kiện nuốt lỗi — sự cố VẪN được ghi vào sổ.

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
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'lsx_orders_changed','lsx_revised',
                  'lsx_cancelled','lsx_header_changed',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));
