-- 0260 — Vai "Kế toán trưởng": người duyệt lương / mở lại kỳ công / phiếu điều chỉnh.
--
-- Chủ dự án chốt 22/10/2026: chị Thảo (Kế toán trưởng) duyệt bảng lương, để bớt việc duyệt của
-- Giám đốc. Nhân sự tự chốt kỳ, không qua duyệt. Ba quyền duyệt trước đây gieo cho vai `director`
-- (0240, 0244, 0246); nay chuyển sang vai riêng `chief_accountant`, để ai được xếp vào Ban Giám đốc
-- sau này KHÔNG tự nhận quyền duyệt lương.
--
--   hr.payroll.approve          duyệt / trả lại bảng lương (chỉ thấy tổng theo bộ phận)
--   hr.period.reopen_decide     duyệt mở lại kỳ công đã chốt
--   hr.attendance.adjust_decide duyệt phiếu điều chỉnh chấm công (vai admin vẫn giữ — 0240)
--
-- Gán người vào vai là DỮ LIỆU (màn Phân quyền), không nằm trong migration này.
-- RLS: không tạo bảng / view mới; chỉ ghi `roles` + `role_permissions` (đã bật RLS, không policy).
-- Idempotent: tạo vai nếu chưa có, chèn quyền on conflict do nothing, gỡ khỏi director bằng delete.

insert into public.roles (key, label, description, is_system, is_active, sort_order)
values (
  'chief_accountant',
  'Kế toán trưởng',
  'Duyệt bảng lương, duyệt mở lại kỳ công, duyệt phiếu điều chỉnh chấm công. Tạo 22/10/2026 để tách việc duyệt lương khỏi vai Ban Giám đốc.',
  false,
  true,
  101
)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join (
  values ('hr.payroll.approve'), ('hr.period.reopen_decide'), ('hr.attendance.adjust_decide')
) as p(key)
where r.key = 'chief_accountant'
on conflict do nothing;

delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id
  and r.key = 'director'
  and rp.permission_key in (
    'hr.payroll.approve',
    'hr.period.reopen_decide',
    'hr.attendance.adjust_decide'
  );
