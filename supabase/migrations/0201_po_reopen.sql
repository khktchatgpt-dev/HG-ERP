-- 0201 — MỞ LẠI ĐƠN MUA ĐÃ DUYỆT ĐỂ SỬA.
--
-- Không thêm bảng/cột nào: `reopen` chỉ đặt đơn về 'draft' và xoá các dấu
-- duyệt/gửi/xác nhận đã có sẵn. Migration này chỉ NỚI HAI CHECK CONSTRAINT để
-- vết mới ghi được (thiếu thì insert bị chặn và handler nuốt lỗi IM LẶNG — vẫn
-- mở lại được đơn nhưng dòng thời gian và thông báo trống trơn):
--
--   1) approval_events.action  + 'reopened'    (mốc gỡ chữ ký duyệt)
--   2) notifications.type      + 'po_reopened' (báo người duyệt)
--
-- (2) đồng thời VÁ LỆCH ĐÃ CÓ: 'lsx_orders_changed' và 'lsx_revised' nằm trong
-- union TypeScript (notifications.repo.ts) nhưng chưa bao giờ được thêm vào
-- constraint — mọi thông báo hai loại đó đang bị DB chặn im lặng. Danh sách
-- dưới đây là bản 0162 + ba giá trị.
--
-- RLS: hai bảng đã ENABLE, no policies (anon chặn, secret key bypass) — không
-- đổi posture. Idempotent: drop + re-add constraint, chạy lại an toàn.

-- 1) Audit vòng duyệt
alter table public.approval_events
  drop constraint if exists approval_events_action_check;
alter table public.approval_events
  add constraint approval_events_action_check
  check (action in ('approved', 'rejected', 'submitted', 'withdrawn',
                    'reassigned', 'reopened'));

-- 2) Thông báo
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low','wh_return','wh_doc_reversed',
                  'wh_stocktake_pending','wh_stocktake_approved','wh_stocktake_rejected',
                  'po_submitted','po_approved','po_rejected',
                  'po_withdrawn','po_reopened','po_reassigned','po_closed_short','po_late',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'lsx_orders_changed','lsx_revised',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));
