-- Báo giá: dựng LẠI luồng Giám đốc duyệt — lần này TUỲ CHỌN (exec v3, 15/08/2026).
--
-- Lịch sử: 0013 sinh ra với luồng duyệt bắt buộc (draft/pending/approved/rejected);
-- 0022 bỏ duyệt, rút về draft → sent; 0025 (destructive, áp thủ công) đòi drop 3
-- cột duyệt — CHƯA TỪNG ÁP remote (repo vẫn select 3 cột đó và app vẫn chạy).
-- Bản này nối lại vòng đời có duyệt nhưng KHÔNG bắt buộc: Sale tự quyết báo giá
-- nào cần chữ ký GĐ (docs/exec-v3-approval-center.md):
--
--   draft ──"Chốt & gửi khách"──────────────────────────► sent
--   draft ──"Trình GĐ"──► pending_approval ──► approved ──► sent
--                                    └───────► rejected ──(sửa, trình lại)──► pending_approval
--
-- Việc làm ở đây:
--   1. sales_quotes: nới check status; thêm submitted_at/submitted_by; bù 3 cột
--      duyệt bằng ADD IF NOT EXISTS (lành cả hai thế giới: 0025 đã áp hay chưa).
--   2. approval_events: nhận entity_type 'quote' — lịch sử ký của GĐ ghi cả báo giá.
--   3. RBAC: permission mới 'sales.quote.approve', gán sẵn cho vai director.
--
-- ⚠ 0025 coi như BỎ — đừng áp nó sau bản này (áp là app gãy vì repo cần 3 cột).
-- RLS: không đổi (mọi bảng đã ENABLED, no policies — anon bị chặn, secret key
-- bypass). Idempotent — chạy lại an toàn. Sau khi áp: "sync types".

-- 1) Vòng đời mới ------------------------------------------------------------
alter table public.sales_quotes
  drop constraint if exists sales_quotes_status_check;
alter table public.sales_quotes
  add constraint sales_quotes_status_check
  check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'sent'));

alter table public.sales_quotes
  add column if not exists submitted_at    timestamptz,
  add column if not exists submitted_by    uuid references public.users(id) on delete set null,
  add column if not exists approved_by     uuid references public.users(id) on delete set null,
  add column if not exists approved_at     timestamptz,
  add column if not exists rejected_reason text;

-- Hộp ký của GĐ lọc đúng một trạng thái — partial index thay index thường.
drop index if exists public.sales_quotes_status_idx;
create index if not exists sales_quotes_status_idx
  on public.sales_quotes (status) where status in ('pending_approval', 'sent');

-- 2) Lịch sử ký nhận 'quote' -------------------------------------------------
alter table public.approval_events
  drop constraint if exists approval_events_entity_type_check;
alter table public.approval_events
  add constraint approval_events_entity_type_check
  check (entity_type in ('po', 'lsx', 'quote'));

-- 3) RBAC: quyền duyệt báo giá — theo đúng mẫu supply.po.approve (0073) -------
insert into public.permissions (key, label, domain, sort_order) values
  ('sales.quote.approve', 'Duyệt / từ chối báo giá', 'sales', 33)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, 'sales.quote.approve'
from public.roles r
where r.key = 'director'
on conflict do nothing;
