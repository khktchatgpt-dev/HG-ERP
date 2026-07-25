-- 0089_production_component_specs.sql — bổ sung định mức còn thiếu vào bảng
-- định hình, đối chiếu file Excel gốc ("Tổng TĐ SX-TK-KT", user chốt 07/2026).
--
-- File Excel có cột "Độ dày" (khác cột "Dày" = kích thước ngoài) mang giá trị
-- "đặc" hoặc một số — đó là ĐỘ DÀY THÀNH ỐNG (đặc/rỗng), ảnh hưởng trực tiếp số
-- kí (ống Ø19 dày 1.2mm nặng khác thanh đặc Ø19). production_components (0084)
-- mới có spec_thickness_mm = "Dày" ngoài, CHƯA có độ dày thành. Thêm:
--   wall_thickness_mm  độ dày thành ống (mm); NULL = thanh ĐẶC (không có thành).
--   unit               đơn vị tính (cái / cụm / bộ / kg / m) — nhãn báo cáo,
--                      NULL = suy theo kind (chi tiết→cái, cụm→cụm).
--
-- Đại lượng dẫn xuất (kg cần, số cây, tổng kg cả lệnh) VẪN không lưu cứng — tính
-- ở service/UI. Hai cột này chỉ là dữ liệu định mức tĩnh người nhập.
--
-- RLS không đổi (bảng đã enable, no policies). Chỉ ADD COLUMN IF NOT EXISTS nên
-- idempotent, không đụng dữ liệu cũ (mọi dòng hiện có: NULL → đặc / suy kind).
-- Apply xong: "sync types" (đã cập nhật tay database.types.ts kèm migration này).

alter table public.production_components
  add column if not exists wall_thickness_mm numeric(10, 2)
    check (wall_thickness_mm > 0),
  add column if not exists unit text;
