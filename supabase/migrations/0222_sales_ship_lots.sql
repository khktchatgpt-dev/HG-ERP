-- 0222: KẾ HOẠCH XUẤT CỦA SALE THEO LỆNH — chia đợt (PO khách) × SL từng SP (06/10/2026).
--
-- Vì sao: Sale lên kế hoạch xuất cho từng lệnh sản xuất theo sổ Excel riêng —
-- mỗi lệnh chia thành các PO khách (Order #, PO khách, PO tham chiếu), mỗi PO
-- có SL từng SP + Factory Ship Date (ảnh sổ IBIZA 06/10). Trước đây chỉ chia
-- được qua NHÓM của dòng lệnh, mà sửa dòng lệnh đã duyệt là tạo BẢN CHỈNH SỬA
-- lệnh (phát hành lại cho xưởng). Chủ dự án chốt: màn chia đợt RIÊNG cho Sale,
-- không đụng bản chỉnh sửa của lệnh.
--
-- Hai bảng:
--   sales_ship_lots       — một đợt xuất kế hoạch của một lệnh (PO + ngày xuất)
--   sales_ship_lot_lines  — SL từng SP trong đợt; SP khoá bằng `product_key`
--                           = mã SP trên dòng lệnh (đã gọn khoảng trắng) để cùng
--                           cột với lưới kế hoạch (lib/ke-hoach-xuat `khoaSp`).
-- Lệnh CÓ đợt ở đây thì màn Kế hoạch xuất dùng đợt của Sale; KHÔNG có thì vẫn
-- đọc nhóm của dòng lệnh như cũ.
--
-- RLS: bật, KHÔNG policy (anon bị chặn, secret key của server đi vòng) — mọi
-- truy cập qua API, quyền ở service (`sales.order.manage` để sửa).
-- Idempotent: create … if not exists; trigger bỏ-rồi-tạo.

create table if not exists public.sales_ship_lots (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
    references public.production_orders (id) on delete cascade,
  seq integer not null default 1,
  -- PO khách (vd Menards PO "HCXD73295828") và PO tham chiếu (vd Enchante PO "29415").
  po_no text,
  po_ref text,
  -- Số thứ tự đơn bên khách (cột "Order #" trong sổ).
  order_no text,
  ship_date date,
  note text,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_ship_lots_lsx_idx
  on public.sales_ship_lots (production_order_id, seq);
create index if not exists sales_ship_lots_ship_date_idx
  on public.sales_ship_lots (ship_date);

drop trigger if exists trg_sales_ship_lots_updated_at on public.sales_ship_lots;
create trigger trg_sales_ship_lots_updated_at
  before update on public.sales_ship_lots
  for each row execute function public.set_updated_at();

alter table public.sales_ship_lots enable row level security;

create table if not exists public.sales_ship_lot_lines (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.sales_ship_lots (id) on delete cascade,
  product_key text not null,
  product_id uuid references public.technical_products (id) on delete set null,
  qty numeric(14, 2) not null check (qty >= 0),
  created_at timestamptz not null default now(),
  unique (lot_id, product_key)
);

create index if not exists sales_ship_lot_lines_lot_idx
  on public.sales_ship_lot_lines (lot_id);

alter table public.sales_ship_lot_lines enable row level security;
