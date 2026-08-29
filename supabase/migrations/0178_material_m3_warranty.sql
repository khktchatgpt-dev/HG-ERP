-- 0178 — Danh mục vật tư: thêm m³/SP và Bảo hành
--
-- LÀM GÌ: thêm hai cột vào `warehouse_materials`:
--   · m3_per_unit   numeric  — m³ mỗi đơn vị đặt (mẫu đơn GỖ tính tiền theo m³)
--   · warranty_text text     — bảo hành ("12 tháng"), mẫu đơn MRO
--
-- VÌ SAO: hai số này đã có CỘT RIÊNG trên dòng đơn từ 0139, nhưng danh mục thì
-- chưa — nên người mua gõ lại chúng ở MỌI đơn, và hộp xác nhận "Cập nhật kho
-- vật tư?" (29/08/2026) không có chỗ để đổ về. Đây là hai trường cuối cùng của
-- dòng đơn còn thiếu đường chảy về danh mục.
--
-- RLS: `warehouse_materials` đã bật RLS không policy từ migration tạo bảng —
-- thêm cột không đụng tới tư thế đó (anon vẫn bị chặn, secret key vẫn bypass).
-- Không tạo bảng/view mới nên không có gì phải khai thêm.
--
-- CAVEAT: cột để NULL cho toàn bộ vật tư đang có — không backfill từ dòng đơn
-- cũ. Backfill hàng loạt sẽ chọn đại một đơn trong lịch sử làm nguồn sự thật,
-- trong khi cùng một mã có thể đặt nhiều quy cách khác nhau qua các năm. Số sẽ
-- tự đầy dần qua hộp xác nhận, đúng một lần mỗi vật tư, do người mua duyệt.

alter table public.warehouse_materials
  add column if not exists m3_per_unit numeric,
  add column if not exists warranty_text text;

comment on column public.warehouse_materials.m3_per_unit is
  'm³ mỗi đơn vị đặt — mẫu đơn gỗ tính tiền theo m³ (0139 có cột này trên dòng đơn).';
comment on column public.warehouse_materials.warranty_text is
  'Bảo hành dạng chữ ("12 tháng") — mẫu đơn MRO.';

-- Idempotent: `add column if not exists` chạy lại không lỗi; comment ghi đè được.
