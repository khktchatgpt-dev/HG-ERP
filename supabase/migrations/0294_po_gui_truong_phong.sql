-- 0294: NV GỬI THẲNG GIÁM ĐỐC → BÁO TRƯỞNG PHÒNG (05/11/2026, chủ dự án chốt luồng
-- sau khi thử 0293 trên đơn thật).
--
-- Luồng: NV lập NHÁP — không có mốc "gửi trưởng phòng"; trưởng phòng Cung ứng
-- thấy mọi nháp ở "Chờ tôi xem", bấm "Đã xem — trình GĐ" là đơn lên Chờ GĐ
-- duyệt (vết `submitted` + `reviewed` đã có từ 0293), hoặc "Trả lại để sửa"
-- (vết `returned`, đã có). Khi cần NV "Gửi thẳng Giám đốc": Giám đốc được báo
-- ngay (`po_submitted`), trưởng phòng được báo để biết — loại MỚI
-- `po_sent_direct`. Vì vậy migration này CHỈ nới notifications.type.
--
-- Danh sách = đúng ràng buộc ĐANG CÓ trên DB (đọc pg_get_constraintdef
-- 05/11/2026, sau 0293: 74 loại) + 1 loại mới. Không bỏ loại nào.
--
-- RLS: không đổi (bảng đã enable RLS, không policy — anon bị chặn, khoá bí mật
-- bypass). Idempotent: drop constraint if exists rồi add lại.
-- Áp TRƯỚC khi mã mới lên main (nới ràng buộc sớm là vô hại với mã cũ).

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
    'lsx_doi_cho_soat', 'lsx_header_changed', 'lsx_orders_changed',
    'lsx_rejected', 'lsx_revised', 'lsx_submitted', 'order_cancelled',
    'order_changed', 'overdue', 'payroll_approved', 'payroll_calculated',
    'payroll_returned', 'payroll_submitted', 'po_adjusted', 'po_answered',
    'po_approved', 'po_approved_unreviewed', 'po_closed_short',
    'po_inbound_moved', 'po_inbound_soon', 'po_issue', 'po_late', 'po_question',
    'po_reassigned', 'po_rejected', 'po_reopened', 'po_returned',
    'po_review_requested', 'po_reviewed', 'po_submitted', 'po_unapproved',
    'po_urgent_sent', 'po_withdrawn', 'quote_approved', 'quote_rejected',
    'quote_submitted', 'reassigned', 'rejected', 'stage_handoff',
    'status_changed', 'submitted', 'wh_doc_reversed', 'wh_receipt', 'wh_return',
    'wh_stock_low', 'wh_stocktake_approved', 'wh_stocktake_pending',
    'wh_stocktake_rejected',
    'po_sent_direct'
  ]::text[]));
