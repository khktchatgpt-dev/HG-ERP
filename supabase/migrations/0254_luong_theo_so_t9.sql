-- 0254_luong_theo_so_t9.sql
-- CÔNG THỨC LƯƠNG KHỚP SỔ KẾ TOÁN T9/2026 (đối chiếu 20/10/2026, Q1–Q7 theo đề xuất).
-- Sổ TTSX / GTSX / VP / QC của Kế toán tính khác ERP ở 7 chỗ; migration này thêm tham số
-- để hàm `lib/luong/tinh-luong.ts` tính đúng như sổ:
--
-- 1. hr_calc_versions (tham số LƯƠNG của bản cách tính — đọc riêng, không thuộc quy tắc công):
--    · standard_days      công chuẩn cố định (KT luôn chia 26); null = đếm ngày kỳ trừ CN, lễ.
--    · lunch_pay_percent  giờ giải lao trả theo % riêng (KT gộp nhóm 22h–6h = 210 %); null =
--                         cộng vào giờ hành chính × hệ số làm trưa như cũ.
--    · withhold_tax       có trừ thuế TNCN trên bảng không (Q5: tính và bày, KHÔNG trừ).
--    Bản 1 nhận 26 · 210 · không trừ.
-- 2. hr_pay_profiles:
--    · ot_rate_per_hour   tăng ca khoán đ/giờ (QC 20.000 đ/giờ); null = theo hệ số khung.
--    · union_member       trừ đoàn phí NLĐ 0,5 % × lương đóng BH (sổ T9: 2 người đóng BH
--                         nhưng không trừ đoàn phí).
-- 3. hr_pay_profile_allowances — cách tính TỪNG dòng phụ cấp (sổ T9 cùng một khoản mà người
--    chia 26, người chia 32; độc hại nhân theo công + công tăng ca; cơm 25.000 × công):
--    · calc          'chia' = mức ÷ divisor × công · 'nhan' = mức × công · 'co_dinh' = mức
--    · divisor       số chia cho 'chia' (26, 32…); null = công chuẩn
--    · incl_overtime 'nhan' tính cả công tăng ca (sổ: "(công + công TC) × mức")
-- 4. hr_payslips: union_fee_employee (đoàn phí NLĐ đã trừ), tax_withheld (thuế có trừ không).
-- 5. hr_calc_rates.percent numeric(6,2) → (9,4): tăng ca của KT là 0,5 ÷ 3 = 133,333…%; lưu
--    133,33 lệch ~90 đ một người một kỳ, 133,3333 lệch dưới 1 đ.
--
-- RLS: không tạo bảng mới; các bảng trên đã bật RLS không policy (khoá anon, khoá bí mật của
-- server bỏ qua) — giữ nguyên. Chạy lại nhiều lần an toàn.

alter table public.hr_calc_versions add column if not exists standard_days integer;
alter table public.hr_calc_versions add column if not exists lunch_pay_percent numeric(6, 2);
alter table public.hr_calc_versions add column if not exists withhold_tax boolean not null default false;

update public.hr_calc_versions
set standard_days = 26, lunch_pay_percent = 210
where version_no = 1 and standard_days is null and lunch_pay_percent is null;

alter table public.hr_pay_profiles add column if not exists ot_rate_per_hour numeric(14, 2);
alter table public.hr_pay_profiles add column if not exists union_member boolean not null default true;

alter table public.hr_pay_profile_allowances add column if not exists calc text not null default 'chia';
alter table public.hr_pay_profile_allowances add column if not exists divisor numeric(6, 2);
alter table public.hr_pay_profile_allowances add column if not exists incl_overtime boolean not null default false;

alter table public.hr_pay_profile_allowances drop constraint if exists hr_pay_profile_allowances_calc_check;
alter table public.hr_pay_profile_allowances
  add constraint hr_pay_profile_allowances_calc_check check (calc in ('chia', 'nhan', 'co_dinh'));

alter table public.hr_payslips add column if not exists union_fee_employee numeric(14, 0) not null default 0;
alter table public.hr_payslips add column if not exists tax_withheld boolean not null default true;

alter table public.hr_calc_rates alter column percent type numeric(9, 4);
