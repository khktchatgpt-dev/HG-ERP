-- 0085_production_v2_perms_receipt.sql — quyền theo VAI mới + xác nhận nhận VT.
--
-- Đi kèm 0084 (thiết kế lại khu SX theo vai). Hai việc:
--
-- 1. RBAC: thêm permission 'production.plan.manage' (Trưởng phòng Kế hoạch: lộ
--    trình + giao tổ + hạn + ưu tiên lệnh — tách khỏi 'production.components.edit'
--    vì định hình bảng chi tiết giờ là việc của THỐNG KÊ xưởng, user chốt 07/2026).
--    Grant: director + planner. Đồng thời grant production_staff →
--    'production.components.edit' (thống kê thuộc xưởng tự tạo bảng chi tiết).
--    Các permission sự cố (production.incident.*) GIỮ trong từ vựng (vô hại,
--    admin có thể thu hồi grant) — module sự cố đã bỏ khỏi hệ (báo ngoài).
--
-- 2. production_orders: thêm materials_received_at/by — xưởng xác nhận đã nhận
--    vật tư xuất kho theo LSX (FR-PROD-02). Trước ghi vào production_progress
--    (đã drop ở 0084) → giờ là mốc 1 lần trên header lệnh.
--
-- RLS: không đổi posture (permissions/role_permissions/production_orders đã
-- enable từ 0073/0014). Idempotent: on conflict do nothing + add column if not
-- exists. Apply: `npx supabase db push` / SQL editor. Sau đó "sync types".

-- ── 1. Permission mới + grants ───────────────────────────────────────────────

insert into public.permissions (key, label, domain, sort_order) values
  ('production.plan.manage', 'Kế hoạch SX: lộ trình + giao tổ + hạn + ưu tiên', 'production', 23)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, v.perm
from (values
  ('director', 'production.plan.manage'),
  ('planner',  'production.plan.manage'),
  ('production_staff', 'production.components.edit')
) as v(role_key, perm)
join public.roles r on r.key = v.role_key
on conflict do nothing;

-- ── 2. Mốc nhận vật tư trên header LSX ───────────────────────────────────────

alter table public.production_orders
  add column if not exists materials_received_at timestamptz,
  add column if not exists materials_received_by uuid
    references public.users(id) on delete set null;
