-- 0189: TỶ GIÁ + HẠN THANH TOÁN CÓ CẤU TRÚC — nền của công nợ NCC đa tiền tệ.
--
-- Vì sao cần: đo 11/09/2026 có 42 đơn mua VND + 24 đơn USD, **6 lệnh sản xuất
-- mang cả hai**, và **KHÔNG bảng nào có cột tỷ giá**. Hệ thống biết một đơn
-- bằng USD nhưng không biết 1 USD bằng bao nhiêu VND, nên không thể nói "đang
-- nợ nhà cung cấp bao nhiêu" bằng MỘT con số. Xem docs/cong-no-ncc-va-da-tien-te.md
--
-- ⭐ TỶ GIÁ CỦA CHỨNG TỪ ĐÃ GHI SỔ KHÔNG BAO GIỜ ĐỔI. Vì thế mỗi chứng từ lưu
-- CỨNG `fx_rate` + `fx_date` + `amount_base` (đã quy VND) ngay lúc ghi, chứ
-- không tra bảng tỷ giá lúc đọc. Tra lúc đọc nghĩa là mỗi ngày mở sổ ra một con
-- số khác, và không đối chiếu được với báo cáo đã in tháng trước.
--
-- Tiền hạch toán của công ty là VND — `amount_base` luôn là VND, không cấu hình.
-- Công ty một xưởng, không hợp nhất tập đoàn; thêm tầng cấu hình lúc chưa đau là
-- tự trói (mục 7 docs/cung-ung-redesign.md).
--
-- RLS: enable, no policies (anon chặn, secret-key server bypass).
-- Idempotent: create if not exists / add column if not exists.

-- ── 1. Bảng tỷ giá ────────────────────────────────────────────────────────
create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  -- Ngoại tệ. VND KHÔNG nằm ở đây: quy VND sang VND luôn là 1, khai vào bảng
  -- chỉ tạo chỗ cho ai đó gõ nhầm 1 thành 1000.
  currency text not null check (currency <> 'VND' and char_length(currency) = 3),
  rate_date date not null,
  -- 1 đơn vị ngoại tệ = bao nhiêu VND. Ví dụ USD 25.400.
  rate numeric(18, 4) not null check (rate > 0),
  -- 'vcb' / 'tay' / tên ngân hàng — text tự do theo quy ước dự án, không FK.
  source text,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Một ngoại tệ một ngày một tỷ giá. Hai dòng cùng ngày thì không ai biết chứng
-- từ đã dùng dòng nào, và số quy đổi thành thứ không kiểm lại được.
create unique index if not exists fx_rates_currency_date_uq
  on public.fx_rates (currency, rate_date);
create index if not exists fx_rates_lookup_idx
  on public.fx_rates (currency, rate_date desc);

alter table public.fx_rates enable row level security;

-- ── 2. Lưu cứng tỷ giá lên chứng từ ghi sổ ────────────────────────────────
alter table public.accounting_supplier_invoices
  -- Tỷ giá ĐÃ DÙNG lúc ghi sổ. null = chứng từ VND (không cần quy đổi).
  add column if not exists fx_rate numeric(18, 4) check (fx_rate is null or fx_rate > 0),
  add column if not exists fx_date date,
  -- Tổng thanh toán quy VND. Lưu cứng để báo cáo cộng được mà không tra lại.
  add column if not exists amount_base numeric(18, 2);

alter table public.accounting_supplier_payments
  add column if not exists fx_rate numeric(18, 4) check (fx_rate is null or fx_rate > 0),
  add column if not exists fx_date date,
  add column if not exists amount_base numeric(18, 2);

-- ── 3. Hạn thanh toán CÓ CẤU TRÚC ─────────────────────────────────────────
-- `supply_suppliers.payment_terms` và `supply_purchase_orders.terms_payment` là
-- CHỮ TỰ DO ("Chuyển khoản 30 ngày kể từ ngày nhận đủ") — in lên phiếu thì tốt,
-- nhưng máy không suy ra được ngày đến hạn, nên không có bảng tuổi nợ. Thêm một
-- cột SỐ bên cạnh; chữ giữ nguyên cho phiếu in, số dành cho máy tính hạn.
alter table public.supply_suppliers
  add column if not exists payment_net_days integer
    check (payment_net_days is null or (payment_net_days >= 0 and payment_net_days <= 365));

comment on column public.supply_suppliers.payment_net_days is
  'Số ngày được nợ kể từ ngày hoá đơn. NULL = chưa khai (hạn phải gõ tay trên từng hoá đơn). Chữ mô tả vẫn ở payment_terms.';

alter table public.accounting_supplier_invoices
  -- Chép lại lúc tạo hoá đơn để về sau đổi điều khoản NCC không làm đổi hạn của
  -- hoá đơn đã phát hành — chứng từ đã ghi sổ phải bất biến.
  add column if not exists net_days integer
    check (net_days is null or (net_days >= 0 and net_days <= 365));
