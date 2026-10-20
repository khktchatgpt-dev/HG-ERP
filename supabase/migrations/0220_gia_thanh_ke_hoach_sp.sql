-- 0220 — GIÁ THÀNH KẾ HOẠCH THEO SẢN PHẨM (bước 2 của giám sát tài chính GĐ).
--
-- Vì sao: đọc 4 file báo giá của Sale (Quotation Halston · File tính giá hệ
-- nhôm gỗ MERXX · Quotation 01.26 YOTRIO · BOM-HG Rosco) ngày 02/10/2026 —
-- mọi file cùng MỘT khuôn, tính bằng USD:
--     trực tiếp  = nhôm/sắt + khoán công + đóng+kiểm + xuất hàng + bao bì
--                  + vật tư + sơn + gỗ + vải/nệm
--     chi phí chung = trực tiếp × a%          (a: 10–20%, Sale đặt theo SP)
--     lợi nhuận  = (trực tiếp + chi phí chung) × b%   (b: 5–14%)
--     Total      = giá FOB
-- a%, b% KHÔNG cố định → lưu BỐN SỐ TUYỆT ĐỐI, % là số suy ra lúc đọc.
-- `plan_breakdown` giữ nguyên các dòng trực tiếp của bảng tính (nhôm, công,
-- bao bì…) để bước 4 so từng khoản với đơn mua thật.
--
-- Đây là số KẾ HOẠCH lúc báo giá, không phải giá thành thật; bản revise mới
-- thay bản cũ (chỉ giữ số mới nhất, không lịch sử — chốt 02/10/2026).
-- `plan_fx_rate` = tỷ giá Sale dùng trong bảng tính để quy dòng VND sang USD
-- (25.000–26.000), lưu để truy lại số VND gốc; khác bảng fx_rates của Kế toán.
--
-- RLS: không tạo bảng mới, không đổi tư thế. Idempotent.
-- Apply: `npx supabase db push` hoặc MCP apply_migration. Sau đó "sync types".

alter table public.technical_products
  add column if not exists plan_direct_cost numeric(18, 2)
    check (plan_direct_cost is null or plan_direct_cost >= 0),
  add column if not exists plan_overhead numeric(18, 2)
    check (plan_overhead is null or plan_overhead >= 0),
  add column if not exists plan_profit numeric(18, 2),
  add column if not exists plan_price numeric(18, 2)
    check (plan_price is null or plan_price >= 0),
  add column if not exists plan_currency char(3),
  add column if not exists plan_fx_rate numeric(18, 4)
    check (plan_fx_rate is null or plan_fx_rate > 0),
  add column if not exists plan_breakdown jsonb,
  add column if not exists plan_source text,
  add column if not exists plan_at date,
  add column if not exists plan_by uuid references public.users(id) on delete set null;

comment on column public.technical_products.plan_direct_cost is
  'Chi phí trực tiếp / 1 đơn vị theo bảng tính giá của Sale (0220), theo plan_currency.';
comment on column public.technical_products.plan_overhead is
  'Chi phí chung / 1 đơn vị (= trực tiếp × a%, a do Sale đặt theo SP).';
comment on column public.technical_products.plan_profit is
  'Lợi nhuận kế hoạch / 1 đơn vị (= (trực tiếp + chi phí chung) × b%). Có thể âm khi Sale chấp nhận bán dưới giá.';
comment on column public.technical_products.plan_price is
  'Giá FOB kế hoạch / 1 đơn vị = trực tiếp + chi phí chung + lợi nhuận.';
comment on column public.technical_products.plan_currency is
  'Tiền tệ của bốn số kế hoạch — theo bản báo giá (USD), không quy đổi.';
comment on column public.technical_products.plan_fx_rate is
  'Tỷ giá VND/ngoại tệ Sale dùng trong bảng tính để quy dòng VND sang USD. Khác fx_rates.';
comment on column public.technical_products.plan_breakdown is
  'Các dòng trực tiếp của bảng tính: [{"label":"nhôm","amount":18.48}, …] — chỉ để soi và đối chiếu.';
comment on column public.technical_products.plan_source is
  'Tên bản báo giá / bảng tính đã lấy số (vd "Quotation - Halston 10/07/2026").';
comment on column public.technical_products.plan_at is
  'Ngày nạp số kế hoạch.';
