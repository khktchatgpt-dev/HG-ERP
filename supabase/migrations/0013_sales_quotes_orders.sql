-- Kinh doanh: báo giá + đơn hàng bán (FR-SAL-01..07, BR-04).
--
-- Chuỗi trạng thái đặc tả (Nháp → Chờ duyệt BG → Đã duyệt → Đã phát LSX → …)
-- tách làm 2: quotes.status (draft/pending/approved/rejected) +
-- orders.status (confirmed → … → delivered). BR-04 (chỉ báo giá đã duyệt mới
-- thành đơn) thực thi ở service, không ràng DB.
--
-- Theo mẫu in thật (docs/db-design-inputs-analysis.md):
--   - currency mặc định USD phía bán (báo giá/hợp đồng in FOB Quy Nhon bằng USD);
--     KHÔNG quy đổi tỷ giá GĐ1.
--   - quotes: valid_from/valid_to, price_term, payment_terms (in trên mẫu báo giá).
--   - orders: customer_po_no (in trên LSX), deposit_percent, container_summary
--     (sale contract: deposit 20%, "1 x 40'HC").
--   - order_changes: lịch sử thay đổi đơn (FR-SAL-05), change jsonb tự do.
--
-- RLS: ENABLED, NO policies trên mọi bảng (anon bị chặn, server bypass).
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

-- Báo giá ----------------------------------------------------------------------

create table if not exists public.sales_quotes (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,                       -- BG-2026-0001 (next_doc_code)
  customer_id     uuid not null references public.sales_customers(id) on delete restrict,
  status          text not null default 'draft'
                    check (status in ('draft', 'pending', 'approved', 'rejected')),
  currency        char(3) not null default 'USD',
  valid_from      date,
  valid_to        date,
  price_term      text,                                       -- vd 'FOB Quy Nhon'
  payment_terms   text,                                       -- vd 'L/C at sight'
  note            text,
  created_by      uuid references public.users(id) on delete set null,
  approved_by     uuid references public.users(id) on delete set null,
  approved_at     timestamptz,
  rejected_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists sales_quotes_customer_idx
  on public.sales_quotes (customer_id, created_at desc);
create index if not exists sales_quotes_status_idx
  on public.sales_quotes (status) where status = 'pending';   -- màn duyệt của GĐ

drop trigger if exists trg_sales_quotes_updated_at on public.sales_quotes;
create trigger trg_sales_quotes_updated_at
  before update on public.sales_quotes
  for each row execute function public.set_updated_at();

alter table public.sales_quotes enable row level security;

create table if not exists public.sales_quote_lines (
  id         uuid primary key default gen_random_uuid(),
  quote_id   uuid not null references public.sales_quotes(id) on delete cascade,
  product_id uuid not null references public.technical_products(id) on delete restrict,
  qty        numeric(14, 2) not null check (qty > 0),
  unit_price numeric(18, 2) not null default 0 check (unit_price >= 0),
  note       text,
  sort_order int not null default 0
);

create index if not exists sales_quote_lines_quote_idx
  on public.sales_quote_lines (quote_id);

alter table public.sales_quote_lines enable row level security;

-- Đơn hàng bán ------------------------------------------------------------------

create table if not exists public.sales_orders (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,                     -- DH-2026-0001
  quote_id          uuid not null references public.sales_quotes(id) on delete restrict,
  customer_id       uuid not null references public.sales_customers(id) on delete restrict, -- denorm từ quote
  customer_po_no    text,                                     -- số PO của khách (in trên LSX)
  status            text not null default 'confirmed'
                      check (status in ('confirmed', 'lsx_issued', 'in_production',
                                        'completed', 'delivered', 'cancelled')),
  currency          char(3) not null default 'USD',
  due_date          date,                                     -- cảnh báo trễ (FR-SAL-09)
  deposit_percent   numeric(5, 2) check (deposit_percent between 0 and 100),
  price_term        text,
  payment_terms     text,
  container_summary text,                                     -- vd '1 x 40''HC'
  note              text,
  created_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists sales_orders_customer_idx
  on public.sales_orders (customer_id, created_at desc);
create index if not exists sales_orders_status_idx
  on public.sales_orders (status);
create index if not exists sales_orders_quote_idx
  on public.sales_orders (quote_id);

drop trigger if exists trg_sales_orders_updated_at on public.sales_orders;
create trigger trg_sales_orders_updated_at
  before update on public.sales_orders
  for each row execute function public.set_updated_at();

alter table public.sales_orders enable row level security;

create table if not exists public.sales_order_lines (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid not null references public.technical_products(id) on delete restrict,
  qty        numeric(14, 2) not null check (qty > 0),
  unit_price numeric(18, 2) not null default 0 check (unit_price >= 0),
  note       text,
  sort_order int not null default 0
);

create index if not exists sales_order_lines_order_idx
  on public.sales_order_lines (order_id);
create index if not exists sales_order_lines_product_idx
  on public.sales_order_lines (product_id);

alter table public.sales_order_lines enable row level security;

-- Lịch sử thay đổi đơn (FR-SAL-05) ----------------------------------------------

create table if not exists public.sales_order_changes (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.sales_orders(id) on delete cascade,
  changed_by uuid references public.users(id) on delete set null,
  change     jsonb not null,                                  -- {field, from, to} hoặc snapshot lines
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists sales_order_changes_order_idx
  on public.sales_order_changes (order_id, created_at desc);

alter table public.sales_order_changes enable row level security;
