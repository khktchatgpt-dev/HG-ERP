-- 0303_sp_showroom_treo_the.sql
-- Thẻ treo showroom ghi THẲNG trên hồ sơ SP (phiếu 101026 của PKD, 17/11/2026).
--
-- Chủ dự án 18/11: "chỉ muốn xác nhận có mẫu ở showroom hay không và đã gắn thẻ
-- treo cho từng sản phẩm chưa — sao hồ sơ sản phẩm không làm luôn". Cờ có mẫu đã
-- có sẵn (`showroom_sample`, 0026); thêm đúng MỘT cột cho thẻ treo, tick trên
-- danh sách SP `/products` và trong hồ sơ SP. Màn rà soát riêng dựng trước đó
-- (cột 0302 trên technical_samples) đã gỡ — cột 0302 để nguyên, không dùng.
--
--   showroom_tagged_at — ngày treo thẻ; null = chưa treo.
--
-- RLS: technical_products đã ENABLED no-policies từ 0012 — không đổi.
-- Idempotent: add column if not exists.

alter table public.technical_products
  add column if not exists showroom_tagged_at timestamptz;
