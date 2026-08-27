-- 0175: TÁCH VAI Thống kê ↔ Tổ trưởng — thực hiện Bước 1 (phạm vi + phân quyền).
--
-- VÌ SAO: phạm vi nghiệp vụ chốt 26/08/2026 nói rõ Thống kê KHÔNG được
--   (a) tự xác nhận số liệu của mình, (b) tự hoàn thành lệnh sản xuất,
--   (c) tự thay đổi công đoạn.
-- Nhưng ma trận hiện tại cho cả xưởng DÙNG CHUNG một vai `production_staff`,
-- nên 7 tài khoản thống kê đang làm được đủ ba việc bị cấm:
--   * `production.member` mở luôn action `production.jobs.confirm` → tự xác nhận;
--   * `production.progress.track` = "Báo hoàn thành LSX" → tự hoàn thành lệnh;
--   * `production.components.edit` = định hình + LỘ TRÌNH → tự đổi công đoạn.
-- Hai vai `production_stat` / `production_leader` tồn tại nhưng KHÔNG có quyền
-- nào (chỉ là nhãn UI) — migration này biến chúng thành vai thật.
--
-- Tổ chức đọc từ dữ liệu thật: mỗi tổ có 1 tài khoản "Thống kê Tổ X" (7 cái) và
-- tổ trưởng là `departments.head_user_id` (5 người: Hàn, May, Phôi, Sơn Nhôm,
-- Sơn Sắt; Nguội + Cơ Điện chưa có tổ trưởng).
--
-- AN TOÀN KHI GỠ: `production.components.edit` vẫn còn ở planner/director/admin
-- (Kế hoạch SX định hình), `production.progress.track` vẫn còn ở director +
-- vai toàn cục manager (quản đốc báo hoàn thành) — không việc nào mất chủ.
--
-- RLS: không đổi posture (roles/role_permissions enable RLS no policy từ 0073).
-- Idempotent: insert on conflict do nothing; delete theo cặp khoá.

-- 1) Từ vựng mới: quyền xác nhận của TỔ TRƯỞNG (trước đây action này mở cho mọi
--    `production.member`, tức cả thống kê).
insert into public.permissions (key, label, domain, sort_order)
values ('production.jobs.confirm', 'Tổ trưởng xác nhận Xong công đoạn', 'production', 65)
on conflict (key) do nothing;

-- 2) Thống kê: bộ quyền ĐỦ để làm 12 việc được phép, KHÔNG có 3 việc bị cấm.
insert into public.role_permissions (role_id, permission_key)
select r.id, v.pkey
from (values
  ('production_stat', 'production.member'),
  ('production_stat', 'production.team.manage'),
  ('production_stat', 'production.output.record'),
  ('production_stat', 'production.outsource.record'),
  ('production_stat', 'production.daylock.lock'),
  ('production_stat', 'production.incident.report'),
  -- Tổ trưởng: chỉ giám sát + xác nhận, KHÔNG nhập sổ.
  ('production_leader', 'production.member'),
  ('production_leader', 'production.team.manage'),
  ('production_leader', 'production.jobs.confirm'),
  ('production_leader', 'production.incident.report')
) as v(rkey, pkey)
join public.roles r on r.key = v.rkey
on conflict do nothing;

-- 3) Gỡ khỏi vai NỀN `production_staff` những quyền không phải của mọi NV xưởng.
--    Giữ lại: production.member, production.team.manage, production.incident.report.
delete from public.role_permissions rp
using public.roles r
where r.id = rp.role_id
  and r.key = 'production_staff'
  and rp.permission_key in (
    'production.output.record',      -- chỉ Thống kê ghi sổ
    'production.outsource.record',   -- chỉ Thống kê ghi gia công ngoài
    'production.daylock.lock',       -- chỉ Thống kê chốt sổ
    'production.components.edit',    -- CẤM: tự thay đổi công đoạn
    'production.progress.track'      -- CẤM: tự hoàn thành lệnh sản xuất
  );

-- 4) Gán vai Tổ trưởng cho người đang là trưởng đơn vị của một tổ sản xuất.
-- `source` chỉ nhận 'derived' | 'manual' — vai này SUY từ departments.head_user_id
-- nên là 'derived' (admin đổi trưởng đơn vị thì gán lại, không phải gán tay).
insert into public.user_roles (user_id, role_id, source)
select d.head_user_id, r.id, 'derived'
from public.departments d
join public.roles r on r.key = 'production_leader'
join public.users u on u.id = d.head_user_id and u.deleted_at is null
where d.workspace_id = 'production'
  and d.head_user_id is not null
on conflict do nothing;
