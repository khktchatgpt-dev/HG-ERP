-- 0188: HOÁ ĐƠN NHÀ CUNG CẤP có DÒNG — mắt xích cuối của Procure-to-Pay.
--
-- Vì sao không dùng lại `accounting_invoices`: bảng đó là SỔ ĐĂNG KÝ hoá đơn,
-- không phải sổ chi tiết công nợ. Nó chỉ có `party_name` (chữ tự do) — không
-- nối được nhà cung cấp, không nối đơn mua, không nối phiếu nhập, và không có
-- dòng. Thiếu cả bốn thứ thì không đối chiếu ba chiều được. Giữ nguyên bảng cũ
-- cho dữ liệu đã có; bảng mới đứng riêng.
--
-- ⭐ `po_line_id` LÀ KHOÁ NỐI CỦA CẢ BA CHIỀU — không cần FK hoá đơn ↔ phiếu nhập:
--     ĐẶT   supply_purchase_order_lines.id
--     VỀ    warehouse_movements.po_line_id   (phiếu đảo mang dấu âm khi cấn trừ)
--     ĐÒI   accounting_supplier_invoice_lines.po_line_id   ← bảng này
--   Ba sổ cùng quy về một dòng đơn mua, nên "lệch nằm ở đâu" trả lời được theo
--   TỪNG DÒNG chứ không chỉ theo tổng đơn.
--
-- KHÔNG có cột trạng thái thanh toán và KHÔNG có 'overdue': "đã trả bao nhiêu"
-- là phép cộng trên sổ thanh toán (0167), "quá hạn" là phép so ngày với
-- `due_date`. Đóng băng chúng thành cột là lối mòn #4 của tieu-chi-workflow-erp.
--
-- KHÔNG có cột tiền suy ra (thành tiền dòng đơn mua): tiền của dòng đơn phụ
-- thuộc `price_basis`/`qty2` và đang tính bằng `poLineAmount` trong TS. Viết
-- lại công thức đó trong SQL là dựng nguồn số thứ hai để hai bên lệch nhau.
--
-- RLS: enable, no policies (anon chặn, secret-key server bypass).
-- Idempotent: create if not exists cho cả bảng lẫn index.

create table if not exists public.accounting_supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supply_suppliers(id) on delete restrict,
  -- Số hoá đơn do NCC in ra — KHÔNG phải số của mình, nên không qua doc_counters.
  invoice_no text not null,
  -- Ngày trên tờ hoá đơn. Khác `created_at` (lúc gõ vào máy) — kế toán vào sổ
  -- muộn vài ngày là chuyện thường, và kỳ kế toán tính theo ngày TRÊN HOÁ ĐƠN.
  invoice_date date not null,
  -- Hạn thanh toán. Trống = chưa thoả thuận; "quá hạn" suy từ cột này, không lưu.
  due_date date,
  currency text not null default 'VND',
  -- Ba số ghi theo ĐÚNG TỜ HOÁ ĐƠN, không suy từ dòng: NCC làm tròn kiểu của
  -- họ, và số phải trả là số trên giấy. Lệch giữa tổng dòng và tổng tờ được
  -- BÀY RA ở màn đối chiếu chứ không âm thầm sửa lại.
  subtotal numeric(16, 2) not null default 0 check (subtotal >= 0),
  vat_amount numeric(16, 2) not null default 0 check (vat_amount >= 0),
  total numeric(16, 2) not null default 0 check (total >= 0),
  -- draft: đang nhập, CHƯA tính vào công nợ · posted: đã vào sổ · cancelled: huỷ.
  -- Ba bước, không hơn: thêm trạng thái lúc chưa đau là tự trói (mục 7 của
  -- docs/cung-ung-redesign.md).
  status text not null default 'draft'
    check (status in ('draft', 'posted', 'cancelled')),
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Một NCC không thể có hai hoá đơn cùng số. Chặn ở DB vì đây là luật của tờ
-- giấy, không phải quy ước của app — và nhập trùng hoá đơn là trả tiền hai lần.
create unique index if not exists accounting_supplier_invoices_no_uq
  on public.accounting_supplier_invoices (supplier_id, lower(invoice_no));

create index if not exists accounting_supplier_invoices_supplier_idx
  on public.accounting_supplier_invoices (supplier_id, invoice_date desc);
create index if not exists accounting_supplier_invoices_due_idx
  on public.accounting_supplier_invoices (due_date)
  where status = 'posted';

create table if not exists public.accounting_supplier_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null
    references public.accounting_supplier_invoices(id) on delete cascade,
  -- NULL = dòng KHÔNG thuộc đơn mua nào: phí vận chuyển, bao bì NCC tính thêm,
  -- chênh lệch làm tròn. Có thật trên hoá đơn nên phải chứa được, nhưng nó
  -- không vào đối chiếu ba chiều (không có vế "đặt" để so).
  po_line_id uuid references public.supply_purchase_order_lines(id) on delete set null,
  -- Chép nguyên văn tên hàng TRÊN HOÁ ĐƠN, không lấy tên trong danh mục: khi
  -- hai bên gọi khác nhau thì đó chính là thứ người đối chiếu cần nhìn thấy.
  description text not null,
  qty numeric(14, 3) not null check (qty > 0),
  unit text,
  unit_price numeric(18, 2) not null check (unit_price >= 0),
  amount numeric(16, 2) not null check (amount >= 0),
  -- VAT theo DÒNG: một hoá đơn có thể lẫn 8% và 10%.
  vat_rate numeric(5, 2) check (vat_rate >= 0 and vat_rate <= 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists accounting_supplier_invoice_lines_inv_idx
  on public.accounting_supplier_invoice_lines (invoice_id, sort_order);
-- Index theo dòng đơn mua: đường đọc chính của đối chiếu ba chiều là "dòng đơn
-- này đã bị đòi tiền mấy lần, ở những hoá đơn nào".
create index if not exists accounting_supplier_invoice_lines_po_line_idx
  on public.accounting_supplier_invoice_lines (po_line_id)
  where po_line_id is not null;

drop trigger if exists set_updated_at on public.accounting_supplier_invoices;
create trigger set_updated_at
  before update on public.accounting_supplier_invoices
  for each row execute function public.set_updated_at();

alter table public.accounting_supplier_invoices enable row level security;
alter table public.accounting_supplier_invoice_lines enable row level security;
