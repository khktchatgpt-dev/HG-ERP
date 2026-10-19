-- 0235_hr_ngay_co_luot.sql — Hàm "những ngày đã có lượt quẹt" (giờ Việt Nam).
--
-- Ngăn "Chấm công một người" (duyệt 16/10/2026) phải phân biệt ngày người đó KHÔNG
-- quẹt với ngày ERP CHƯA LẤY dữ liệu về (cả công ty không có lượt nào). Lịch sử lần
-- lấy (0233) không đủ — tháng 9 nạp trước khi có bảng đó. Đọc thẳng từ lượt: gom
-- ngày trong DB thay vì kéo hàng chục nghìn dòng về server.
--
-- RLS: hàm SECURITY INVOKER (mặc định) → chạy với quyền người gọi; hr_attendance_logs
-- bật RLS không policy nên anon/authenticated không đọc được gì, khoá bí mật bỏ qua.
-- Thu hồi EXECUTE của anon/authenticated cho rõ ý.
-- Idempotent: create or replace.

create or replace function public.hr_attendance_days(p_from timestamptz, p_to timestamptz)
returns setof date
language sql
stable
set search_path = public
as $$
  select distinct (punched_at at time zone 'Asia/Ho_Chi_Minh')::date
  from public.hr_attendance_logs
  where punched_at >= p_from and punched_at < p_to
  order by 1
$$;

revoke execute on function public.hr_attendance_days(timestamptz, timestamptz) from public, anon, authenticated;
