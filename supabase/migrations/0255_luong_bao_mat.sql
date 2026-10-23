-- 0255_luong_bao_mat.sql
-- (Đánh số lại 21/10/2026: viết với tên 0253 — trùng 0253_feedback đã lên main. Nội dung
-- không đổi, đã áp lên DB ngày 20/10 dưới tên cũ.)
-- LƯƠNG LÀ BÍ MẬT — chỉ MỘT người quản lý (yêu cầu 20/10/2026: "lương ở phòng kế toán chỉ
-- duy nhất 1 người là Phụng quản lí, không ai khác được biết, trong phòng kế toán cũng như
-- nhân sự lương là bảo mật"; Q8–Q13 duyệt theo đề xuất).
--
-- 1. Vai mới `payroll_officer` "Quản lý lương" — vai DUY NHẤT mang hai quyền lương
--    `hr.payroll.profile` (hồ sơ lương, số tài khoản, lương ghi trên hợp đồng) và
--    `hr.payroll.run` (tính · gửi · chi bảng lương). Không ai được gán sẵn: tài khoản
--    của Phụng tạo xong mới gán (insert user_roles, source='manual').
-- 2. Rút hai quyền đó khỏi MỌI vai khác (đang có ở vai director từ 0245).
--    `hr.payroll.approve` giữ cho director — màn duyệt chỉ thấy tổng theo bộ phận (bước sau).
-- 3. Mã ứng dụng đi kèm (actions.ts `mat: true`, rbac.service): hai quyền trên KHÔNG còn đi
--    kèm phòng Kế toán, quản trị viên KHÔNG tự có, màn phân quyền không thêm / bớt được.
-- 4. Nhật ký xem lương dùng chung `hr_private_access_log`: thêm loại `payroll_list`,
--    `payroll_profile`, `payroll_sheet`, `payroll_excel`, `salary_tab`; `employee_id` được
--    trống (xem cả bảng); thêm cột `note`.
--
-- RLS: không tạo bảng mới. `roles`, `role_permissions`, `hr_private_access_log` đã bật RLS
-- không policy (khoá anon, khoá bí mật của server bỏ qua) — giữ nguyên.
-- Giới hạn: ứng dụng chặn; người giữ khoá cơ sở dữ liệu vẫn đọc được bảng (Q13 — chưa mã hoá
-- cột tiền). Chạy lại nhiều lần an toàn.

insert into public.roles (key, label, description, is_system, is_active, sort_order)
values (
  'payroll_officer',
  'Quản lý lương',
  'Vai duy nhất xem / sửa hồ sơ lương, tính và chi bảng lương. Quyền mật: quản trị viên không tự có, không gán qua màn phân quyền.',
  true,
  true,
  21
)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      is_system = true,
      is_active = true;

insert into public.permissions (key, label, domain, sort_order) values
  ('hr.payroll.profile', 'Xem và sửa hồ sơ lương nhân viên', 'hr', 80),
  ('hr.payroll.run', 'Tính, gửi duyệt và chi bảng lương', 'hr', 81)
on conflict (key) do nothing;

delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id
  and rp.permission_key in ('hr.payroll.profile', 'hr.payroll.run')
  and r.key <> 'payroll_officer';

insert into public.role_permissions (role_id, permission_key)
select r.id, k.key
from public.roles r
cross join (values ('hr.payroll.profile'), ('hr.payroll.run')) as k(key)
where r.key = 'payroll_officer'
on conflict do nothing;

-- Nhật ký xem lương ────────────────────────────────────────────────────────────
alter table public.hr_private_access_log alter column employee_id drop not null;
alter table public.hr_private_access_log add column if not exists note text;

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.hr_private_access_log'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%field%'
  loop
    execute format('alter table public.hr_private_access_log drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.hr_private_access_log
  add constraint hr_private_access_log_field_check check (
    field in (
      'bank_account', 'national_id', 'tax_code',
      'payroll_list', 'payroll_profile', 'payroll_sheet', 'payroll_excel', 'salary_tab'
    )
  );

create index if not exists hr_private_access_log_viewed_idx
  on public.hr_private_access_log (viewed_at desc);
