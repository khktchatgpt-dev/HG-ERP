-- 0286_hr_ma_so_bhxh.sql — Mã số BHXH trên hồ sơ nhân viên (Hồ sơ nhân viên B5, bản vẽ
-- 02/11/2026 Q5: "Thêm Mã số BHXH, nạp từ file đóng BHXH của Nhân sự").
--
-- hr_employee_private.social_insurance_no — 10 chữ số (mã số BHXH Việt Nam). Cùng ranh giới riêng
-- tư với CCCD / SĐT: chỉ người có quyền hr.employee.private đọc / ghi (kiểm ở service).
-- Đo 03/11/2026 trên file "DANH SÁCH ĐÓNG BHXH NĂM 2026": tháng 10 có 59 mã, đều 10 chữ số, mỗi
-- dòng có mã đều có CCCD → nạp khớp người theo CCCD.
--
-- RLS: không tạo bảng mới — hr_employee_private đã bật RLS không policy (khoá anon, khoá bí mật
-- của server đi qua), giữ nguyên.
-- Thêm cột rỗng, mã trên main chưa đọc cột này → áp trước khi mã lên main không đổi hành vi gì.
-- Chạy lại nhiều lần an toàn.

alter table public.hr_employee_private
  add column if not exists social_insurance_no text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'hr_employee_private_social_insurance_no_check'
  ) then
    alter table public.hr_employee_private
      add constraint hr_employee_private_social_insurance_no_check
      check (social_insurance_no is null or social_insurance_no ~ '^\d{10}$');
  end if;
end $$;

comment on column public.hr_employee_private.social_insurance_no is
  'Mã số BHXH (10 chữ số) — Hồ sơ nhân viên B5, 0286';
