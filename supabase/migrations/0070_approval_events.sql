-- Ban Giám đốc: LỊCH SỬ PHÊ DUYỆT (audit) — ai duyệt/từ chối phiếu nào, khi nào, lý do.
--
-- Ghi append-only bởi event handler khi `po.decided` / `lsx.decided` (không sửa/xoá).
-- Là nguồn sự thật cho màn "Lịch sử phê duyệt" (GĐ soi) và khắc phục điểm yếu cũ:
-- PO từ chối trước đây chỉ prefix "[Từ chối]" vào note → MẤT người từ chối; giờ
-- actor + lý do được lưu đầy đủ ở đây.
--
-- RLS: ENABLE, no policies (anon bị chặn, server secret key bypass). Idempotent.
-- Apply: `npx supabase db push` / SQL editor. Sau đó "sync types".

create table if not exists public.approval_events (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('po', 'lsx')),
  entity_id   uuid not null,
  entity_code text not null,
  action      text not null check (action in ('approved', 'rejected')),
  actor_id    uuid references public.users(id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists approval_events_created_idx
  on public.approval_events (created_at desc);
create index if not exists approval_events_entity_idx
  on public.approval_events (entity_type, entity_id);

alter table public.approval_events enable row level security;
