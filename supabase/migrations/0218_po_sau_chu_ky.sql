-- 0218 — ĐƠN MUA SAU CHỮ KÝ: thu hồi chữ ký, gửi gấp ký bù, câu hỏi của GĐ.
--
-- Chủ dự án chốt 01/10/2026 (bản vẽ "Duyệt đơn mua BGĐ", phần 2). KHÔNG thêm
-- trạng thái đơn — chín trạng thái giữ nguyên, bộ lọc / nhãn / báo cáo không đổi:
--
--   1) supply_purchase_orders + urgent_sent_at / urgent_sent_by / urgent_reason:
--      đơn GỬI NCC TRƯỚC KHI KÝ (trưởng phòng Cung ứng, lý do bắt buộc). "Chờ ký
--      bù" = urgent_sent_at có + approved_at trống + chưa huỷ. Cần cột riêng vì
--      56/78 đơn đã gửi đang KHÔNG có chữ ký (đơn nạp từ file) — không cột thì
--      không phân biệt được đơn gửi gấp với đơn nạp.
--   2) doc_notes + kind ('note' | 'question') + resolved_at / resolved_by /
--      resolved_how: CÂU HỎI của Giám đốc trên đơn ("Hỏi lại" khi chờ duyệt,
--      "Yêu cầu xem lại" khi đã gửi). Mở cho tới khi người phụ trách trả lời
--      ('answered') hoặc đơn được quyết / thu hồi / huỷ ('decided' | 'closed').
--   3) approval_events.action + 'unapproved' (thu hồi chữ ký), 'urgent_sent'.
--      Ký bù dùng lại 'approved' — đếm số chữ ký không bị tách đôi.
--   4) notifications.type + po_unapproved, po_question, po_answered,
--      po_urgent_sent (bản 0210 + bốn giá trị).
--
-- RLS: không thêm bảng; ba bảng đã ENABLE, no policies (anon chặn, secret key
-- bypass) — giữ nguyên posture. Idempotent: add column if not exists, drop +
-- re-add constraint, create index if not exists.

-- 1) Gửi gấp, ký bù sau
alter table public.supply_purchase_orders
  add column if not exists urgent_sent_at timestamptz,
  add column if not exists urgent_sent_by uuid references public.users(id) on delete set null,
  add column if not exists urgent_reason text;

create index if not exists supply_purchase_orders_urgent_unsigned_idx
  on public.supply_purchase_orders (urgent_sent_at)
  where urgent_sent_at is not null and approved_at is null;

-- 2) Câu hỏi của Giám đốc trên chứng từ
alter table public.doc_notes
  add column if not exists kind text not null default 'note',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.users(id) on delete set null,
  add column if not exists resolved_how text;

alter table public.doc_notes drop constraint if exists doc_notes_kind_check;
alter table public.doc_notes
  add constraint doc_notes_kind_check check (kind in ('note', 'question'));

alter table public.doc_notes drop constraint if exists doc_notes_resolved_how_check;
alter table public.doc_notes
  add constraint doc_notes_resolved_how_check
  check (resolved_how is null or resolved_how in ('answered', 'decided', 'closed'));

create index if not exists doc_notes_open_questions_idx
  on public.doc_notes (doc_type, doc_id)
  where kind = 'question' and resolved_at is null and deleted_at is null;

-- 3) Vết vòng duyệt
alter table public.approval_events
  drop constraint if exists approval_events_action_check;
alter table public.approval_events
  add constraint approval_events_action_check
  check (action in ('approved', 'rejected', 'submitted', 'withdrawn',
                    'reassigned', 'reopened', 'unapproved', 'urgent_sent'));

-- 4) Thông báo
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
                  'po_adjusted',
                  'po_unapproved','po_question','po_answered','po_urgent_sent',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'lsx_orders_changed','lsx_revised',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));
