-- 0293: TRƯỞNG PHÒNG CUNG ỨNG XEM ĐƠN MUA TRƯỚC KHI LÊN BÀN GIÁM ĐỐC (05/11/2026,
-- bản vẽ RcqWLU7F1z33btAR97gZBo, chủ dự án duyệt Q1–Q6).
--
-- KHÔNG thêm trạng thái, KHÔNG thêm cột vào supply_purchase_orders. "Đã xem" là
-- một dòng `reviewed` trong approval_events đứng SAU lần `submitted` cuối của
-- đơn (lib/po-review.ts `reviewMark`). Rút về nháp / bị trả lại rồi gửi lại thì
-- có `submitted` mới → dấu cũ tự hết hiệu lực, không phải dọn cột nào. Chọn
-- cách này cũng để mã cũ trên main không bao giờ đọc phải cột chưa có (bẫy
-- 01/10: thêm cột vào COLS chung khi DB chưa migrate → mọi màn đơn mua rỗng).
--
-- Thay đổi:
--   1. approval_events.action thêm 'reviewed' (trưởng phòng đã xem — trình GĐ)
--      và 'returned' (trưởng phòng trả lại để sửa → nháp; khác 'rejected' của GĐ
--      để Lịch sử ký của Giám đốc không lẫn).
--   2. notifications.type thêm 4 loại:
--        po_review_requested    NV gửi duyệt → trưởng phòng
--        po_reviewed            trưởng phòng đã xem → người duyệt
--        po_returned            trưởng phòng trả lại → người phụ trách đơn
--        po_approved_unreviewed GĐ duyệt khi trưởng phòng chưa xem → trưởng phòng
--      Danh sách = đúng ràng buộc ĐANG CÓ trên DB (đọc pg_get_constraintdef
--      05/11/2026) + 4 loại mới. Không bỏ loại nào: hàng cũ phải còn hợp lệ.
--
-- RLS: không đổi (hai bảng đã enable RLS, không policy — anon bị chặn, khoá bí
-- mật bypass). Idempotent: drop constraint if exists rồi add lại.
-- Áp TRƯỚC khi mã mới lên main: mã cũ không ghi hai action / bốn loại mới nên
-- nới ràng buộc sớm là vô hại; ngược lại mã mới chạy trên DB cũ sẽ lỗi ghi vết.

alter table public.approval_events
  drop constraint if exists approval_events_action_check;
alter table public.approval_events
  add constraint approval_events_action_check
  check (action = any (array[
    'approved', 'rejected', 'submitted', 'withdrawn', 'reassigned',
    'reopened', 'unapproved', 'urgent_sent',
    'reviewed', 'returned'
  ]::text[]));

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array[
    'approved', 'asset_issue_approval', 'asset_issue_decided', 'asset_issue_done',
    'asset_issue_new', 'assigned', 'commented', 'dnm_approved', 'dnm_rejected',
    'dnm_submitted', 'doc_request', 'doc_request_cancelled', 'doc_request_done',
    'doc_request_reassigned', 'doc_request_reopened', 'due_soon',
    'feedback_commented', 'feedback_confirmed', 'feedback_mentioned',
    'feedback_new', 'feedback_processed', 'feedback_reviewed',
    'incident_reported', 'incident_resolved', 'lsx_approved', 'lsx_cancelled',
    'lsx_doi_cho_soat',
    'lsx_header_changed', 'lsx_orders_changed', 'lsx_rejected', 'lsx_revised',
    'lsx_submitted', 'order_cancelled', 'order_changed', 'overdue',
    'payroll_approved', 'payroll_calculated', 'payroll_returned',
    'payroll_submitted', 'po_adjusted', 'po_answered', 'po_approved',
    'po_approved_unreviewed',
    'po_closed_short', 'po_inbound_moved', 'po_inbound_soon', 'po_issue',
    'po_late', 'po_question', 'po_reassigned', 'po_rejected', 'po_reopened',
    'po_returned', 'po_review_requested', 'po_reviewed',
    'po_submitted', 'po_unapproved', 'po_urgent_sent', 'po_withdrawn',
    'quote_approved', 'quote_rejected', 'quote_submitted', 'reassigned',
    'rejected', 'stage_handoff', 'status_changed', 'submitted',
    'wh_doc_reversed', 'wh_receipt', 'wh_return', 'wh_stock_low',
    'wh_stocktake_approved', 'wh_stocktake_pending', 'wh_stocktake_rejected'
  ]::text[]));
