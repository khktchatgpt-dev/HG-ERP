-- 0075_rbac_audit.sql
-- Nhật ký AUDIT thao tác phân quyền (RBAC Phase 3 — IT tự phục vụ ở
-- /admin/permissions). Ghi lại mọi thay đổi: tạo/sửa vai, đặt lại quyền của vai,
-- gán/thu vai của user. Ghi 1 nguồn duy nhất qua event bus (rbac.audit.ts) —
-- service emit sự kiện, handler ghi bảng này; lỗi ghi audit KHÔNG rollback caller.
--
--   action:
--     role.created            — tạo vai mới (after = {key,label})
--     role.updated            — sửa vai   (before/after = field đổi)
--     role.permissions_changed— đặt lại quyền của vai (before/after = {added,removed})
--     role.assigned           — gán 1 vai cho user (after = {role_key,role_label})
--     role.revoked            — thu 1 vai của user (before = {role_key,role_label})
--   target_type = 'role' | 'user'; target_id trỏ role.id hoặc user.id.
--   target_label lưu sẵn nhãn (vai/tên user) để hiện lịch sử không cần join.
--
-- RLS: enable, KHÔNG policy — anon bị chặn, secret-key server bypass (như 0073).
-- Idempotent. Apply: `npx supabase db push` (hoặc MCP). Sau đó "sync types".

create table if not exists public.rbac_audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.users(id) on delete set null,
  action       text not null check (action in (
    'role.created', 'role.updated', 'role.permissions_changed',
    'role.assigned', 'role.revoked'
  )),
  target_type  text not null check (target_type in ('role', 'user')),
  target_id    uuid not null,
  target_label text,
  before       jsonb,
  after        jsonb,
  reason       text,
  created_at   timestamptz not null default now()
);

create index if not exists rbac_audit_created_idx
  on public.rbac_audit_log (created_at desc);
create index if not exists rbac_audit_target_idx
  on public.rbac_audit_log (target_type, target_id, created_at desc);
create index if not exists rbac_audit_actor_idx
  on public.rbac_audit_log (actor_id, created_at desc);

alter table public.rbac_audit_log enable row level security;
