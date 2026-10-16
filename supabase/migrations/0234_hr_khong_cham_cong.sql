-- 0234_hr_khong_cham_cong.sql — Cờ "Không chấm công" cho nhân viên.
--
-- Chủ dự án 15/10/2026: một số người không quẹt máy mà vẫn đi làm (Phòng Kinh
-- Doanh, Tài Xế, Khoán Bốc xếp, Bảo Vệ) — ERP không được coi họ là thiếu công.
-- Mặc định bật theo bộ phận lúc nạp, sửa được từng người ở bước ② Nhân viên & ca.
-- Người không có mã trên máy vẫn có hồ sơ: `code` khi đó là mã nội bộ (KCC-…).
--
-- RLS: hr_employees đã bật RLS không policy từ 0232 (chặn anon, khoá bí mật bỏ qua);
-- migration này chỉ thêm cột.
-- Idempotent: add column if not exists.

alter table public.hr_employees
  add column if not exists attendance_exempt boolean not null default false;

comment on column public.hr_employees.attendance_exempt is
  'Không chấm công: không quẹt máy, không bị tính thiếu công (Kinh Doanh, Tài Xế, …)';
