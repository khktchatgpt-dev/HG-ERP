-- 0261 — Cách tính công "Đủ công" cho tổ (hr_teams.calc_mode = 'du').
--
-- Chủ dự án chốt 22/10/2026 (bản vẽ https://claude.ai/artifact/PYQ1Dw2WkN1Ge3ydzhLchq): văn phòng
-- tính đủ công theo ngày làm việc, chỉ trừ ngày có phiếu Nghỉ — đúng cách sổ lương T9 đang làm
-- (ERP tính "có quẹt = 1 công" thì văn phòng thiếu 44 ngày so với sổ). Ngày lễ = nghỉ lễ có lương.
--
-- Chỉ MỞ RỘNG ràng buộc: thêm giá trị 'du' bên cạnh 'khung' / 'ngay'. Không đổi tổ nào —
-- Nhân sự chọn ở Cách tính › Tổ khi mã mới đã lên (mã cũ hiểu giá trị lạ là 'khung').
-- RLS: không tạo bảng mới; hr_teams đã bật RLS không policy (0242).
-- Idempotent: drop constraint if exists rồi tạo lại.

alter table public.hr_teams drop constraint if exists hr_teams_calc_mode_check;
alter table public.hr_teams
  add constraint hr_teams_calc_mode_check check (calc_mode in ('khung', 'ngay', 'du'));
