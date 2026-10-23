-- 0258 — Quy tắc "làm tròn giờ vào buổi tối" cho bản cách tính công (câu Q1, chốt 21/10/2026).
--
-- Tính thử T9/2026 sáu luật làm tròn so với sổ Nhân sự: sổ làm tròn giờ VÀO ca đêm theo đúng
-- bậc thang của giờ vào buổi chiều (20:43 → 21:00, 20:35 → 20:30). Cột mới
-- hr_calc_versions.round_in_evening = true thì bậc thang giờ vào kéo qua buổi tối (tới 24:00)
-- thay vì dừng ở hết khung hành chính. Mặc định false → bản 1 (kỳ T9) giữ nguyên số đã tính.
-- Chỉ có tác dụng khi round_in_afternoon = true (cùng một bậc thang).
--
-- RLS: không bảng mới; hr_calc_versions đã bật RLS không policy — giữ nguyên.
-- Idempotent: `add column if not exists`.

alter table public.hr_calc_versions
  add column if not exists round_in_evening boolean not null default false;

comment on column public.hr_calc_versions.round_in_evening is
  'Bậc thang giờ vào kéo qua buổi tối (vào ca đêm 20:43 → 21:00). Cần round_in_afternoon.';
