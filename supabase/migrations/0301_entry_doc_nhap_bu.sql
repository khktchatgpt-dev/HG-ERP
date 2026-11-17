-- 0301: CỜ "NHẬP BÙ" TRÊN PHIẾU BÁO SẢN LƯỢNG (bản vẽ Dán sổ Excel 17/11/2026,
-- https://claude.ai/artifact/TN9FdcN5S1mJBDAvwQcsS4, Q4 duyệt).
--
-- Thống kê nhập số CŨ từ sổ Excel (màn /thongke/dan-so): sổ Excel không có giờ
-- công theo phiếu, trong khi phiếu chính thức bắt giờ công (0296, kiểm ở service).
-- Phiếu nhập bù miễn giờ công, tính vào sản lượng + kg, KHÔNG vào Năng suất
-- (luật cũ: phiếu không giờ công vào kg, không vào NS) và gắn nhãn để người soát
-- biết đây là số nạp lại chứ không phải số ghi trong ngày.
--
-- Cột thêm, mặc định false: mã cũ không đọc cột này nên áp DB trước khi mã lên
-- main là AN TOÀN (khác các thay đổi cấu hình — xem BẪY DB đi trước code).
--
-- RLS: bảng đã enable row level security, không policy (0172) — không đổi.
-- Idempotent.

alter table public.production_entry_docs
  add column if not exists nhap_bu boolean not null default false;

comment on column public.production_entry_docs.nhap_bu is
  'true = phiếu NHẬP BÙ số cũ từ sổ Excel (không giờ công, không vào Năng suất).';
