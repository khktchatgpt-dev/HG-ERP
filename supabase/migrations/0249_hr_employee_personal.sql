-- 0249_hr_employee_personal.sql — Thông tin cá nhân trên hồ sơ nhân viên (B2b, bản vẽ Hồ sơ nhân
-- viên lượt 2 duyệt 19/10/2026, Q1–Q6 theo đề xuất; mức trường = sổ quản lý lao động NĐ 145/2020).
--
-- Thêm vào hr_employee_private (bảng riêng tư đã có từ 0245, nơi đang giữ CCCD / MST / STK) —
-- giữ MỘT ranh giới quyền cho mọi thứ riêng tư:
--   birth_date, gender (male|female), nationality, hometown, education
--   id_issue_date, id_issue_place          ngày cấp / nơi cấp CCCD
--   permanent_address, current_address    thường trú / chỗ ở hiện tại
--   phone, emergency_name, emergency_relation, emergency_phone
-- Quyền mới hr.employee.private: xem + sửa thông tin cá nhân. Nhân sự có sẵn qua hr.member (luật
-- trong actions.ts); seed director (Q5: Nhân sự + BGĐ). Người không có quyền thấy mã, tên, tổ,
-- ca, chức danh. Số CCCD vẫn che, bấm Hiện mới ra số và ghi hr_private_access_log.
-- hr_employee_events thêm kind 'edit': lần sửa tại chỗ một khối — chỉ ghi TÊN trường đổi,
-- không ghi giá trị (không để số CCCD nằm trong vết).
--
-- RLS: không đổi (hai bảng đã bật từ 0245 / 0248, không policy).

alter table public.hr_employee_private add column if not exists birth_date date;
alter table public.hr_employee_private add column if not exists gender text;
alter table public.hr_employee_private add column if not exists nationality text;
alter table public.hr_employee_private add column if not exists hometown text;
alter table public.hr_employee_private add column if not exists education text;
alter table public.hr_employee_private add column if not exists id_issue_date date;
alter table public.hr_employee_private add column if not exists id_issue_place text;
alter table public.hr_employee_private add column if not exists permanent_address text;
alter table public.hr_employee_private add column if not exists current_address text;
alter table public.hr_employee_private add column if not exists phone text;
alter table public.hr_employee_private add column if not exists emergency_name text;
alter table public.hr_employee_private add column if not exists emergency_relation text;
alter table public.hr_employee_private add column if not exists emergency_phone text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hr_employee_private_gender_check') then
    alter table public.hr_employee_private add constraint hr_employee_private_gender_check
      check (gender is null or gender in ('male', 'female'));
  end if;
end $$;

alter table public.hr_employee_events drop constraint if exists hr_employee_events_kind_check;
alter table public.hr_employee_events add constraint hr_employee_events_kind_check
  check (kind in ('hire', 'leave', 'rehire', 'transfer', 'edit'));

insert into public.permissions (key, label, domain, sort_order) values
  ('hr.employee.private', 'Xem và sửa thông tin cá nhân nhân viên', 'hr', 78)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, 'hr.employee.private'
from public.roles r
where r.key = 'director'
on conflict do nothing;
