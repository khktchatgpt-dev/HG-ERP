-- 0257 — KHỐI BẢNG LƯƠNG của từng tổ (màn duyệt lương của sếp, bản vẽ duyệt 21/10/2026, Q3:
-- "theo tổ ERP, gom dưới 4 khối như sổ; khối của mỗi tổ đặt một lần ở danh mục tổ").
--
-- Kế toán lập 4 sổ lương: TTSX (trực tiếp sản xuất) · GTSX (gián tiếp sản xuất: kho, thống
-- kê, bảo vệ, bếp/tạp vụ, lái xe) · VP (văn phòng) · QC. Cột mới hr_teams.pay_block nói tổ nào
-- thuộc khối nào; màn duyệt cộng tổng theo khối → tổ. Seed theo đúng cách 4 sổ T9/2026 chia
-- người. Hai tổ khoán (Bốc Xếp, Nguội Anh Sự) KHÔNG có trong sổ nào → để trống, màn bày ở
-- "Chưa xếp khối" cho tới khi Nhân sự / Kế toán đặt.
--
-- RLS: không bảng mới; hr_teams đã bật RLS không policy — giữ nguyên. Idempotent: cột
-- `if not exists`, seed chỉ ghi ô đang trống.

alter table public.hr_teams add column if not exists pay_block text;

alter table public.hr_teams drop constraint if exists hr_teams_pay_block_check;
alter table public.hr_teams
  add constraint hr_teams_pay_block_check check (pay_block in ('ttsx', 'gtsx', 'vp', 'qc'));

update public.hr_teams set pay_block = 'ttsx'
where pay_block is null and name in (
  'Tổ Cơ Điện', 'Tổ Hàn MIG Sắt', 'Tổ Hàn Nhôm', 'Tổ Hoàn Thiện Xưởng 2', 'Tổ Mẫu', 'Tổ May',
  'Tổ Phôi', 'Tổ Phun Sơn PX3', 'Tổ Sơn Nhôm', 'Tổ Sơn Sắt', 'Kiểm Hàng');

update public.hr_teams set pay_block = 'gtsx'
where pay_block is null and name in ('Kho', 'Thống Kê', 'Bảo Vệ', 'Tạp Vụ', 'Tài Xế');

update public.hr_teams set pay_block = 'vp'
where pay_block is null and name in (
  'Phòng Nhân Sự', 'Phòng Kế Hoạch', 'Phòng Kế Toán', 'Phòng Kinh Doanh', 'Phòng Kỹ Thuật');

update public.hr_teams set pay_block = 'qc' where pay_block is null and name = 'QC';
