-- 0283: loại thông báo 'lsx_doi_cho_soat' — lệnh đổi định mức / số cần, chờ
-- Cung ứng soát (B3, 02/11/2026, bản vẽ RL9ToGvjouLFkhNVeruAbS).
--
-- Người nhận: trưởng phòng Cung ứng + người phụ trách các đơn mua của lệnh.
-- MỖI NGƯỜI MỖI LỆNH MỘT TIN CHƯA ĐỌC: payload mang `lsx_id` + `dau` (dấu tập
-- thay đổi); cùng dấu thì bỏ qua, tin cũ chưa đọc thì cập nhật chứ không chèn
-- thêm; bấm "Đã soát" thì mọi tin chưa đọc của lệnh đó tự tắt. Logic ở
-- events/handlers/lenh-doi.notifications.ts — bảng không cần cột mới.
--
-- Danh sách loại = đúng ràng buộc ĐANG CÓ trên DB (đọc pg_get_constraintdef
-- 02/11/2026, gồm cả các loại doc_request* của 0281 không có trong mã main) +
-- loại mới. Không bỏ loại nào: hàng cũ phải còn hợp lệ.
--
-- RLS: không đổi (notifications đã enable RLS, không policy). Idempotent.

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
    'po_closed_short', 'po_inbound_moved', 'po_inbound_soon', 'po_issue',
    'po_late', 'po_question', 'po_reassigned', 'po_rejected', 'po_reopened',
    'po_submitted', 'po_unapproved', 'po_urgent_sent', 'po_withdrawn',
    'quote_approved', 'quote_rejected', 'quote_submitted', 'reassigned',
    'rejected', 'stage_handoff', 'status_changed', 'submitted',
    'wh_doc_reversed', 'wh_receipt', 'wh_return', 'wh_stock_low',
    'wh_stocktake_approved', 'wh_stocktake_pending', 'wh_stocktake_rejected'
  ]::text[]));
