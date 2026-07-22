-- 0074_user_roles_source.sql
-- Cầu đồng bộ RBAC (Phase 1.5): phân biệt role DẪN-XUẤT (tự tính từ vai + phòng)
-- với role GÁN-TAY (IT tự gán ở Phase 3), để syncUserRoles() reconcile mỗi khi
-- user đổi vai/phòng mà KHÔNG ghi đè role IT gán tay.
--
--   source = 'derived' — do hệ thống suy từ users.role + department (sync quản lý).
--   source = 'manual'  — do IT gán trực tiếp (sync KHÔNG đụng).
--
-- Mọi row có sẵn (do backfill 0073) đều là 'derived'.
--
-- RLS: user_roles đã enable ở 0073 (no policies). Idempotent.
-- Apply: `npx supabase db push`. Sau đó "sync types".

alter table public.user_roles
  add column if not exists source text not null default 'manual'
    check (source in ('derived', 'manual'));

-- Row backfill 0073 → đánh dấu 'derived' (chỉ chạy ý nghĩa lần đầu; assigned_by
-- null là dấu hiệu seed hệ thống).
update public.user_roles
  set source = 'derived'
  where source = 'manual' and assigned_by is null;
