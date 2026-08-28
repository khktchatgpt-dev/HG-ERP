-- 0167: accounting_supplier_payments — sổ THANH TOÁN cho nhà cung cấp (GĐ C.1
-- plan-ke-toan-cong-no-ncc). Công nợ KHÔNG lưu cứng: phát sinh = Σ movements
-- nhận có giá (per po_line, phiếu đảo tự cấn trừ) — bảng này chỉ giữ vế ĐÃ TRẢ.
-- Tiền tách theo currency (USD/VND không cộng lẫn — bài học 0134).
-- RLS: enable, no policies (anon chặn, secret-key server bypass).
-- Idempotent: create if not exists / drop trigger if exists.

create table if not exists accounting_supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references supply_suppliers(id) on delete restrict,
  -- Gắn PO là TUỲ CHỌN: xưởng hay trả gộp nhiều đơn một lần chuyển khoản.
  po_id uuid references supply_purchase_orders(id) on delete set null,
  amount numeric(16, 2) not null check (amount > 0),
  currency text not null default 'VND',
  paid_on date not null,
  -- 'ck' / 'tm' / khác — text tự do, không FK danh mục (quy ước dự án).
  method text,
  -- Số UNC / phiếu chi — đối chiếu với sao kê ngân hàng.
  ref_no text,
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounting_supplier_payments_supplier_idx
  on accounting_supplier_payments (supplier_id, paid_on);
create index if not exists accounting_supplier_payments_po_idx
  on accounting_supplier_payments (po_id);

drop trigger if exists set_updated_at on accounting_supplier_payments;
create trigger set_updated_at
  before update on accounting_supplier_payments
  for each row execute function public.set_updated_at();

alter table accounting_supplier_payments enable row level security;
