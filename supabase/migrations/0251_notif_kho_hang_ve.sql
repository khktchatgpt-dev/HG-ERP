-- 0251 — Loại thông báo HÀNG SẮP VỀ cho Kho (Kho đợt 2 · B8b, 19/10/2026).
--
--   po_inbound_soon  — NCC xác nhận đơn có hẹn giao trong 3 ngày tới (hoặc đã quá)
--                      → báo mọi người có vai Kho, trừ người bấm.
--   po_inbound_moved — Cung ứng dời hẹn một đợt / cả đơn đang chờ giao → báo Kho.
--
-- Bản vẽ B8 duyệt Q4/Q5 theo đề xuất (https://claude.ai/artifact/PvUSfGoMDrT7nMjGz4yezC):
-- không báo cả 52 đơn/tháng NCC xác nhận — Kho chỉ cần biết lô sắp tới.
--
-- Chỉ đổi danh sách loại của ràng buộc `notifications_type_check`: giữ NGUYÊN mọi
-- loại của 0237 (bản mới nhất chạm ràng buộc; các migration 0238–0250 trên mọi
-- nhánh không đụng tới) + thêm 2 loại. Không bảng mới, không cột mới.
--
-- Đánh số 0251: nhánh chấm công đã dùng 0247–0250 (0247 trùng tên với
-- 0247_ke_toan_xem_kho đã lên main — chỉ trùng tên file, không ảnh hưởng DB).
--
-- RLS: không đổi — `notifications` đã bật RLS không policy. Idempotent: drop if
-- exists rồi add lại. Chưa áp thì handler gửi thông báo lỗi ràng buộc, bus nuốt
-- lỗi — đơn VẪN xác nhận / dời hẹn bình thường, chỉ Kho chưa nhận thông báo.

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
                  'stage_handoff','incident_reported','incident_resolved'));
