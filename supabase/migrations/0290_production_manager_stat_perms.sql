-- 0290_production_manager_stat_perms.sql — vá ba lỗ quyền lộ ra khi rà B1–B6
-- Sản xuất theo cấu hình (03/11/2026, docs/san-xuat-cau-hinh-thiet-ke.md).
--
-- Đo user_roles + role_permissions thật:
--   1. `production_manager` (hai quản lý xưởng Lê Văn Bảy, Lê Quốc Dương) có
--      production.progress.track nhưng KHÔNG có production.plan.manage → tab
--      "Kế hoạch tổ & hạn" của hồ sơ lệnh khoá, không khai chỉ tiêu ngày được;
--      và KHÔNG có production.output.record → không ghi sổ hộ, không lập / nhận
--      phiếu giao tổ. Tài khoản Kế hoạch duy nhất (planner) đã xoá mềm 01/09 →
--      ngoài Giám đốc / admin không còn ai lên kế hoạch.
--   2. `production_stat` (7 thống kê tổ) thiếu production.components.edit trong
--      khi nhãn của chính quyền đó ghi "Định hình bảng chi tiết (thống kê, từ
--      BOM Kỹ thuật)" — thống kê không định hình được lệnh để ghi sổ.
--
-- Chỉ THÊM quyền cho vai, không đụng user_roles, không bật lại tài khoản nào.
-- RLS không đổi (bảng RBAC đã enable từ 0073/0014). Idempotent: on conflict
-- do nothing; nhật ký quyền ghi before/after thật để màn Nhật ký còn tra được.

create temp table _truoc as
select r.id as role_id, r.key as role_key,
  coalesce(jsonb_agg(rp.permission_key order by rp.permission_key)
    filter (where rp.permission_key is not null), '[]'::jsonb) as perms
from public.roles r
left join public.role_permissions rp on rp.role_id = r.id
where r.key in ('production_manager', 'production_stat')
group by r.id, r.key;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.permission_key
from public.roles r
join (values
  ('production_manager', 'production.plan.manage'),
  ('production_manager', 'production.output.record'),
  ('production_stat',    'production.components.edit')
) as p(role_key, permission_key) on p.role_key = r.key
on conflict do nothing;

insert into public.rbac_audit_log
  (actor_id, action, target_type, target_id, target_label, before, after, reason)
select null, 'role.permissions_changed', 'role', t.role_id, t.role_key, t.perms,
  (select coalesce(jsonb_agg(rp.permission_key order by rp.permission_key), '[]'::jsonb)
     from public.role_permissions rp where rp.role_id = t.role_id),
  'Migration 0290: vá quyền sau rà soát B1–B6 Sản xuất (03/11/2026)'
from _truoc t
where t.perms <> (select coalesce(jsonb_agg(rp.permission_key order by rp.permission_key), '[]'::jsonb)
                    from public.role_permissions rp where rp.role_id = t.role_id);

drop table _truoc;
