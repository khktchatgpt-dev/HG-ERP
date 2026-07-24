-- 0086_director_scope_and_ws_view.sql — bịt lỗ giao diện GĐ + quyền xem tường minh.
--
-- Bối cảnh (user phát hiện 07/2026): mọi users.role='manager' được dẫn xuất vai
-- 'director' (0073 backfill + rbac.derive.ts) → trưởng phòng kho/kế toán/kỹ
-- thuật/quản đốc đều vào được /exec VÀ DUYỆT được LSX/PO. Đồng thời openView
-- cho xem chéo workspace tự do. User chốt:
--   (a) 'director' = manager THUỘC PHÒNG Ban Giám Đốc (departments.workspace_id
--       = 'exec') — khớp rbac.derive.ts bản mới; duyệt tập trung đúng GĐ.
--   (b) Xem workspace khác phòng phải có QUYỀN tường minh: thêm vocabulary
--       'workspace.view.<id>' (5 ws nghiệp vụ; exec dùng exec.tower.view sẵn có;
--       hr/finance/system vẫn chỉ nhà + admin). access.ts đọc các key này.
--   Grants tái tạo nhu cầu thật: director xem mọi nơi; Kế hoạch/Cung ứng xem
--   Sản xuất + Kho. Ai khác cần → admin gán vai/quyền ở /admin/permissions.
--
-- RLS: không đổi posture. Idempotent: on conflict do nothing + delete có điều
-- kiện. Apply: `npx supabase db push` / SQL editor. Không cần sync types.

-- ── 1. Thu hồi vai director dẫn xuất của manager KHÔNG thuộc phòng BGĐ ───────
-- Chỉ đụng source='derived' (vai gán tay giữ nguyên — admin chủ động cấp).
delete from public.user_roles ur
using public.roles r, public.users u
left join public.departments d on d.id = u.department_id
where ur.role_id = r.id
  and ur.user_id = u.id
  and r.key = 'director'
  and ur.source = 'derived'
  and (d.workspace_id is distinct from 'exec');

-- ── 2. Vocabulary quyền XEM workspace ────────────────────────────────────────
insert into public.permissions (key, label, domain, sort_order) values
  ('workspace.view.sales',      'Xem workspace Bán hàng',        'system', 110),
  ('workspace.view.warehouse',  'Xem workspace Kho',             'system', 111),
  ('workspace.view.technical',  'Xem workspace Kỹ thuật',        'system', 112),
  ('workspace.view.production', 'Xem workspace Sản xuất',        'system', 113),
  ('workspace.view.planning',   'Xem workspace Kế hoạch - Cung ứng', 'system', 114)
on conflict (key) do nothing;

-- ── 3. Grants tái tạo nhu cầu xem chéo THẬT ──────────────────────────────────
insert into public.role_permissions (role_id, permission_key)
select r.id, v.pkey
from (values
  ('director', 'workspace.view.sales'),
  ('director', 'workspace.view.warehouse'),
  ('director', 'workspace.view.technical'),
  ('director', 'workspace.view.production'),
  ('director', 'workspace.view.planning'),
  ('planner',  'workspace.view.production'),
  ('planner',  'workspace.view.warehouse'),
  ('supply_staff', 'workspace.view.production'),
  ('supply_staff', 'workspace.view.warehouse')
) as v(rkey, pkey)
join public.roles r on r.key = v.rkey
on conflict do nothing;
