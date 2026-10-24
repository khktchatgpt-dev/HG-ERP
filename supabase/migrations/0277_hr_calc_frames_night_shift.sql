-- 0277 — Khung CA ĐÊM trong bản cách tính (bảng "khung giờ → số công" của công ty, 24/10/2026:
-- "ca qua đêm 18h–6h sáng = 2,1 công", giờ lẻ tính tỉ lệ; chủ dự án chốt "18h–6h là ca đêm luôn").
--
-- Cách mô hình: thêm cờ hr_calc_frames.night_shift. Khung có cờ này CHỒNG lên các khung tối
-- (K2–K6) và đứng ngoài chuỗi 24 giờ. Đoạn làm vào từ giờ tan ca hành chính trở đi và kéo qua 0h
-- là ca đêm: phần giao với khung này đổ vào đây, hưởng hệ số riêng ở hr_calc_rates (2,1 công ÷ 12
-- giờ × 8 = 140 %), không đi qua K2–K6 nữa (`src/lib/cham-cong/gio-khung.ts`, quy tắc 8).
-- Ca dài vào sáng ra sáng hôm sau và tăng ca tới 00:01 không phải ca đêm — vẫn theo khung.
--
-- Không thêm dòng khung ở đây: Bản 2 (kỳ 10) nhận khung K7 "Ca đêm" + hệ số qua service
-- (rút về nháp → lưu → áp dụng lại), Bản 1 (kỳ 9, khớp sổ Kế toán T9) giữ nguyên.
-- RLS: bảng đã bật RLS không policy từ 0243 — không đổi. Idempotent.

alter table public.hr_calc_frames
  add column if not exists night_shift boolean not null default false;

comment on column public.hr_calc_frames.night_shift is
  'Khung ca đêm: chồng lên khung tối, ngoài chuỗi 24 giờ; đoạn vào sau giờ tan ca và qua 0h đổ vào đây (gio-khung quy tắc 8, 24/10/2026)';
