-- 0205: VÁ NỀN KHU SẢN XUẤT — đợt 1 của docs/san-xuat-thiet-ke-giao-dien.md §9.
--
-- Đợt này lẽ ra đi ĐẦU nhưng bị nhảy cóc vì vướng một câu nghiệp vụ; năm màn
-- M1–M5 đã dựng xong trước nó. Ba việc dưới đây là thứ CHẶN người dùng thật,
-- không phải tính năng mới.
--
-- 1) Tổ Sơn Nhôm chưa có `stage_code` nên màn ghi sổ không gợi được tổ khi
--    thống kê mở tab Sơn — mọi số sơn nhôm dễ bị gán nhầm sang Tổ Sơn Sắt (tổ
--    duy nhất đang mang mã 'son'). Ba tổ còn trống CỐ Ý để trống: "Xưởng Sản
--    Xuất" là đơn vị bao trùm chứ không phải một công đoạn; "Cắt Vải" và "Tổ
--    Cơ Điện" không nằm trong lộ trình công đoạn nào.
--
-- 2) Thống kê chốt sổ được nhưng KHÔNG mở khoá được — chốt nhầm lúc cuối ngày
--    là phải gọi Giám đốc. Đây là loại ma sát giết một đợt chạy thử. Người
--    chốt sổ là người sửa được sổ mình vừa chốt; hành vi vẫn có vết
--    (`production_day_locks` ghi ai chốt, ai mở).
--
-- 3) VAI QUẢN ĐỐC chưa tồn tại. Ba người phòng "Xưởng Sản Xuất" chỉ mang
--    `production_staff`, tức không đóng được lệnh, không xác nhận nhận vật tư.
--    Vai giữ câu hỏi "lệnh nào đang kẹt" mà không có quyền nào để xử lý câu
--    trả lời. KHÔNG cấp thẳng cho `production_staff` vì vai nền đó dùng chung
--    cho cả thống kê lẫn tổ viên — 0175 đã cố ý gỡ `production.progress.track`
--    khỏi nó ("thống kê không được tự hoàn thành lệnh"), cấp lại là đảo ngược
--    quyết định đó. Nên đẻ vai riêng.
--
-- 4) Dọn quyền MỒ CÔI: `production.jobs.confirm` (0175) gỡ khỏi mã nguồn
--    18/09/2026 — chủ dự án chốt "tổ trưởng chỉ xem để biết tình hình", và
--    công đoạn nay tự sang "xong" khi sổ đủ số (`jobsRepo.markDone`). Action
--    không còn nên quyền này vô hiệu, nhưng vẫn hiện ở /admin/permissions như
--    một lời hứa không ai thực hiện được.
--
-- RLS: không đổi posture (roles/role_permissions/departments giữ nguyên).
-- Idempotent: update theo điều kiện, insert on conflict do nothing, delete theo
-- khoá — chạy lại nhiều lần cho cùng kết quả.

-- ── 1) Tổ Sơn Nhôm → công đoạn 'son' ────────────────────────────────────────
update public.departments
set stage_code = 'son'
where workspace_id = 'production'
  and name = 'Tổ Sơn Nhôm'
  and stage_code is distinct from 'son';

-- ── 2) Thống kê tự mở khoá sổ ngày ──────────────────────────────────────────
insert into public.role_permissions (role_id, permission_key)
select r.id, 'production.daylock.unlock'
from public.roles r
where r.key = 'production_stat'
on conflict do nothing;

-- ── 3) Vai QUẢN ĐỐC XƯỞNG ───────────────────────────────────────────────────
insert into public.roles (key, label, description, is_system, sort_order)
values (
  'production_manager',
  'Quản đốc xưởng',
  'Điều hành xưởng: đóng lệnh, xác nhận nhận vật tư, mở khoá sổ ngày.',
  true,
  15
)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, v.pkey
from (values
  ('production_manager', 'production.member'),
  ('production_manager', 'production.team.manage'),
  -- Báo hoàn thành LSX + xác nhận xưởng đã nhận vật tư.
  ('production_manager', 'production.progress.track'),
  -- Mở khoá sổ hộ tổ khi thống kê nghỉ.
  ('production_manager', 'production.daylock.unlock'),
  ('production_manager', 'production.incident.report'),
  ('production_manager', 'production.incident.close')
) as v(rkey, pkey)
join public.roles r on r.key = v.rkey
on conflict do nothing;

-- Gán cho người đang thuộc phòng "Xưởng Sản Xuất". `source = 'derived'`: vai
-- SUY từ phòng ban, admin chuyển người sang phòng khác thì gán lại — không
-- phải một lựa chọn thủ công của ai.
insert into public.user_roles (user_id, role_id, source)
select u.id, r.id, 'derived'
from public.users u
join public.departments d on d.id = u.department_id
join public.roles r on r.key = 'production_manager'
where d.workspace_id = 'production'
  and d.name = 'Xưởng Sản Xuất'
  and u.deleted_at is null
on conflict do nothing;

-- ── 4) Dọn quyền mồ côi 'production.jobs.confirm' ───────────────────────────
-- Xoá GRANT trước rồi mới xoá từ vựng: role_permissions trỏ vào permissions.
delete from public.role_permissions
where permission_key = 'production.jobs.confirm';

delete from public.permissions
where key = 'production.jobs.confirm';
