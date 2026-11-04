-- 0291_production_manager_components_edit.sql — quản đốc định hình được lệnh;
-- cụm hồ sơ SP ghi nhớ lộ trình được cập nhật từ lệnh nào (04/11/2026).
--
-- Chủ dự án chốt 04/11: người làm KẾ HOẠCH định hình trên LỆNH là đường chính,
-- hồ sơ SP cập nhật theo (Lưu định hình ghi ngược lộ trình cụm). Hai việc:
--   1. `production_manager` có production.plan.manage (0290) nhưng KHÔNG có
--      production.components.edit → lên kế hoạch được mà định hình không — một
--      việc chia đôi cho hai vai. Thêm quyền; không đụng user_roles.
--   2. `technical_product_clusters` thêm hai cột vết: lộ trình cụm lần cuối được
--      ghi từ đâu (`stages_source`, ví dụ "lsx:01/26-27 - JAWOLL") và lúc nào
--      (`stages_updated_at`) — tab Lộ trình hồ sơ SP nói "cập nhật từ lệnh X".
--      Mã ghi hai cột này bằng một update RIÊNG và nuốt lỗi, nên chưa áp
--      migration thì ghi ngược vẫn chạy, chỉ thiếu dòng vết.
--
-- RLS không đổi (bảng RBAC đã enable từ 0073/0014; technical_product_clusters
-- từ 0106). Idempotent: on conflict do nothing / add column if not exists; nhật
-- ký quyền ghi before/after thật để màn Nhật ký còn tra được.

create temp table _truoc as
select r.id as role_id, r.key as role_key,
  coalesce(jsonb_agg(rp.permission_key order by rp.permission_key)
    filter (where rp.permission_key is not null), '[]'::jsonb) as perms
from public.roles r
left join public.role_permissions rp on rp.role_id = r.id
where r.key = 'production_manager'
group by r.id, r.key;

insert into public.role_permissions (role_id, permission_key)
select r.id, 'production.components.edit'
from public.roles r
where r.key = 'production_manager'
on conflict do nothing;

insert into public.rbac_audit_log
  (actor_id, action, target_type, target_id, target_label, before, after, reason)
select null, 'role.permissions_changed', 'role', t.role_id, t.role_key, t.perms,
  (select coalesce(jsonb_agg(rp.permission_key order by rp.permission_key), '[]'::jsonb)
     from public.role_permissions rp where rp.role_id = t.role_id),
  '0291: quản đốc định hình lệnh — kế hoạch định hình trên lệnh là đường chính (04/11/2026)'
from _truoc t
where not exists (
  select 1 from public.role_permissions rp
  where rp.role_id = t.role_id and rp.permission_key = 'production.components.edit'
    and t.perms ? 'production.components.edit'
);

drop table _truoc;

alter table public.technical_product_clusters
  add column if not exists stages_source text,
  add column if not exists stages_updated_at timestamptz;

comment on column public.technical_product_clusters.stages_source is
  'Lộ trình cụm lần cuối ghi từ đâu: "lsx:<mã lệnh>" (Lưu định hình ghi ngược) hoặc "profile" (sửa tay ở tab Lộ trình). 0291.';
comment on column public.technical_product_clusters.stages_updated_at is
  'Lúc ghi lộ trình cụm lần cuối (0291).';
