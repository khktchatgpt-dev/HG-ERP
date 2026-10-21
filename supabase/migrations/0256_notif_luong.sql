-- 0256 — Loại thông báo của LUỒNG LƯƠNG (bản vẽ duyệt 21/10/2026, Q1–Q5 theo đề xuất,
-- https://claude.ai/artifact/8BH9Nam6pXq9gsNc3NHi5A).
--
--   payroll_calculated — Nhân sự chốt kỳ công → hệ thống tự tính bảng lương nháp → báo người
--                        quản lý lương (quyền hr.payroll.run).
--   payroll_submitted  — người quản lý lương gửi bảng chờ sếp duyệt (bước 2: màn duyệt).
--   payroll_approved   — sếp duyệt → báo người gửi.
--   payroll_returned   — sếp trả lại kèm lý do → báo người gửi.
--
-- Chỉ đổi danh sách loại của ràng buộc `notifications_type_check`: giữ NGUYÊN mọi loại đang
-- có trên DB (0251 + 6 loại feedback_* của 0253_feedback trên main) + thêm 4 loại.
-- Không bảng mới, không cột mới.
--
-- RLS: không đổi — `notifications` đã bật RLS không policy. Idempotent: drop if exists rồi
-- add lại. Chưa áp thì handler gửi thông báo lỗi ràng buộc, bus nuốt lỗi — kỳ công VẪN
-- chốt và bảng lương VẪN tự tính, chỉ chưa có thông báo.

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
                  'po_inbound_soon','po_inbound_moved',
                  'dnm_submitted','dnm_approved','dnm_rejected',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'lsx_orders_changed','lsx_revised',
                  'lsx_cancelled','lsx_header_changed',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved',
                  'feedback_new','feedback_reviewed','feedback_processed',
                  'feedback_commented','feedback_mentioned','feedback_confirmed',
                  'payroll_calculated','payroll_submitted','payroll_approved','payroll_returned'));
