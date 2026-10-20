-- 0219 — TỶ GIÁ CHỐT TRÊN ĐƠN MUA VÀ ĐƠN BÁN (bước 1 của giám sát tài chính GĐ).
--
-- Vì sao: 0189 đã có bảng `fx_rates` và cột tỷ giá trên HOÁ ĐƠN + PHIẾU TRẢ,
-- nhưng ĐƠN MUA và ĐƠN BÁN thì chưa. Đo 02/10/2026: 19 đơn mua USD, 36 đơn bán
-- USD, không đơn nào mang tỷ giá — màn Tiền theo lệnh không cộng được đơn USD
-- với đơn VND, và doanh thu USD không quy VND được để so với tiền mua.
--
-- Chốt với chủ dự án 02/10/2026:
--   · Đơn mua chốt tỷ giá LÚC GIÁM ĐỐC DUYỆT (`approved_at`); đơn bán chốt LÚC
--     XÁC NHẬN ĐƠN (đơn bán sinh ra đã là `confirmed`). Hạ đơn mua về nháp thì
--     xoá tỷ giá cùng với `approved_at` — duyệt lại là chốt lại.
--   · Thiếu tỷ giá KHÔNG chặn duyệt: Kế toán chưa nhập thì đơn vẫn đi, cột để
--     null, màn Tỷ giá bày "N chứng từ thiếu" + nút gán lại.
--   · CHỈ lưu `fx_rate` + `fx_date`, KHÔNG lưu `amount_base` như hoá đơn (0189):
--     dòng hàng của đơn đã gửi vẫn sửa được (28/09/2026), số quy VND lưu cứng
--     sẽ lệch với dòng ngay lần sửa đầu. Quy VND = Σ dòng × fx_rate, tính lúc đọc.
--   · Tỷ giá đã chốt KHÔNG đổi theo bảng `fx_rates` — đọc cột trên đơn, không
--     tra lại (luật 1 của `lib/fx.ts`).
--
-- `fx_date` là NGÀY CHỐT của chứng từ (ngày duyệt / ngày xác nhận), không phải
-- `rate_date` của dòng tỷ giá: giữ ngày này để biết đã tra bảng theo ngày nào.
--
-- RLS: không tạo bảng mới, không đổi tư thế (mọi bảng đã enable RLS, no
-- policies — anon chặn, secret key server bypass). Idempotent.
-- Apply: `npx supabase db push` hoặc MCP apply_migration. Sau đó "sync types".

alter table public.supply_purchase_orders
  add column if not exists fx_rate numeric(18, 4)
    check (fx_rate is null or fx_rate > 0),
  add column if not exists fx_date date;

comment on column public.supply_purchase_orders.fx_rate is
  '1 đơn vị ngoại tệ = bao nhiêu VND, chốt lúc GĐ duyệt (0219). null = đơn VND hoặc chưa có tỷ giá lúc duyệt. Không đổi theo bảng fx_rates.';
comment on column public.supply_purchase_orders.fx_date is
  'Ngày đã tra bảng tỷ giá (= ngày duyệt). Null khi fx_rate null.';

alter table public.sales_orders
  add column if not exists fx_rate numeric(18, 4)
    check (fx_rate is null or fx_rate > 0),
  add column if not exists fx_date date;

comment on column public.sales_orders.fx_rate is
  '1 đơn vị ngoại tệ = bao nhiêu VND, chốt lúc xác nhận đơn (0219). null = đơn VND hoặc chưa có tỷ giá. Không đổi theo bảng fx_rates.';
comment on column public.sales_orders.fx_date is
  'Ngày đã tra bảng tỷ giá (= ngày xác nhận đơn). Null khi fx_rate null.';

-- Màn Tỷ giá đếm "chứng từ ngoại tệ thiếu tỷ giá" — lọc theo (currency, fx_rate null).
create index if not exists supply_purchase_orders_fx_missing_idx
  on public.supply_purchase_orders (currency)
  where fx_rate is null;
create index if not exists sales_orders_fx_missing_idx
  on public.sales_orders (currency)
  where fx_rate is null;
