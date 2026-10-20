-- Sản xuất: VẾT THAY ĐỔI của lệnh sản xuất (07/10/2026, lượt 3 hoàn thiện Sale).
--
-- Trước đây lệnh chỉ giữ `revision_note` CUỐI CÙNG: sửa đầu lệnh sau khi GĐ
-- duyệt (đổi hạn xuất, đổi số lệnh) không để lại vết, bản sửa 2 đè lý do bản
-- sửa 1, huỷ lệnh không ghi ai huỷ vì sao. Bảng này là sổ append-only theo
-- đúng mẫu `sales_order_changes` (0013): mỗi dòng một sự kiện, `change` jsonb
-- {type, fields{from,to}, …}, `note` = lý do người dùng gõ.
--
-- Loại sự kiện dự kiến: header_changed · revised · cancelled · deleted_draft ·
-- synced_from_orders. Lịch sử chuẩn của ĐƠN vẫn ở sales_order_changes.
--
-- RLS: ENABLED, NO policies (anon chặn, server secret key bypass — chuẩn dự án).
-- Idempotent. Apply: SQL editor / supabase db push. Sau đó "sync types".

create table if not exists public.production_order_changes (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  changed_by          uuid references public.users(id) on delete set null,
  change              jsonb not null,
  note                text,
  created_at          timestamptz not null default now()
);

create index if not exists production_order_changes_lsx_idx
  on public.production_order_changes (production_order_id, created_at desc);

alter table public.production_order_changes enable row level security;

-- Hai loại thông báo mới cho lệnh: huỷ lệnh · đổi đầu lệnh sau duyệt (hạn xuất,
-- số lệnh, container) — xưởng + Cung ứng phải biết. Chép đủ danh sách từ 0218.
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
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'lsx_orders_changed','lsx_revised',
                  'lsx_cancelled','lsx_header_changed',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));
