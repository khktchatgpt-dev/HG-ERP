-- Cung ứng: NCC + đơn đặt vật tư + nối chuỗi kho (FR-SUP-01..07, BR-05/06/08/09).
--
-- BR-06 ép ở DB: PO có đúng 1 LSX + 1 NCC (2 cột NOT NULL FK).
-- BR-05 (GĐ duyệt mới gửi NCC): service chặn chuyển 'ordered' khi chưa 'approved'.
-- BR-08 (thiếu = đặt − nhận): KHÔNG denorm — view supply_po_line_status tính từ
-- sổ cái warehouse_movements. Nhận = cả đạt lẫn loại QC (loại vẫn là "đã về",
-- BR-10: loại không vào tồn vì chỉ qty đạt cộng tồn).
--
-- Theo mẫu in đơn đặt NCC thật (docs/db-design-inputs-analysis.md §1.3):
--   - PO: vat_rate + price_includes_vat ("đơn giá đã/chưa gồm VAT 10%"),
--     expected_at (thời gian giao hàng), terms (bảo hành…), currency mặc định VND.
--   - Line: spec (quy cách), qty2/unit2 (ĐVT kép: cây↔kg, tấm↔m² — OI-10 mức
--     nhập liệu chưa chốt, DB chứa sẵn), note (gắn bộ phận SP: "chân trước"…).
--
-- Nâng cấp warehouse_movements (thay ref_no text bằng FK thật + chuẩn bị GĐ sau):
--   - warehouse_id (backfill MAIN), po_line_id (nhập theo đơn — FR-WMS-02),
--     production_order_id (xuất theo LSX — BR-09, check NOT VALID vì dữ liệu cũ
--     chỉ có ref_no text), transfer_group (điều chuyển), unit_cost (giá trị
--     nhập/xuất — GĐ sau, UI ẩn). ref_type thêm 'transfer'/'adjust' (mẫu in 1C).
--
-- RLS: ENABLED, NO policies mọi bảng; view security_invoker = on.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

-- Nhà cung cấp -------------------------------------------------------------------

create table if not exists public.supply_suppliers (
  id         uuid primary key default gen_random_uuid(),
  code       text unique,
  name       text not null check (char_length(name) between 1 and 200),
  email      text,
  phone      text,
  address    text,
  tax_no     text,
  note       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supply_suppliers_name_idx
  on public.supply_suppliers (lower(name));

drop trigger if exists trg_supply_suppliers_updated_at on public.supply_suppliers;
create trigger trg_supply_suppliers_updated_at
  before update on public.supply_suppliers
  for each row execute function public.set_updated_at();

alter table public.supply_suppliers enable row level security;

-- Đơn đặt hàng vật tư (PO) ---------------------------------------------------------

create table if not exists public.supply_purchase_orders (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,                   -- PO-2026-0001
  production_order_id uuid not null                           -- ⭐ BR-06: đúng 1 LSX
                        references public.production_orders(id) on delete restrict,
  supplier_id         uuid not null                           -- ⭐ BR-06: đúng 1 NCC
                        references public.supply_suppliers(id) on delete restrict,
  status              text not null default 'pending_approval'
                        check (status in ('pending_approval', 'approved', 'ordered',
                                          'confirmed', 'in_transit', 'partial',
                                          'received', 'cancelled')),
  currency            char(3) not null default 'VND',
  vat_rate            numeric(5, 2) check (vat_rate between 0 and 100),
  price_includes_vat  boolean not null default true,
  expected_at         date,                                   -- thời gian giao hàng
  terms               text,                                   -- bảo hành, điều kiện in trên mẫu
  approved_by         uuid references public.users(id) on delete set null,  -- BR-05
  approved_at         timestamptz,
  ordered_at          timestamptz,
  note                text,
  created_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists supply_pos_lsx_idx
  on public.supply_purchase_orders (production_order_id);
create index if not exists supply_pos_supplier_idx
  on public.supply_purchase_orders (supplier_id, created_at desc);
create index if not exists supply_pos_status_idx
  on public.supply_purchase_orders (status) where status = 'pending_approval';  -- màn duyệt GĐ

drop trigger if exists trg_supply_purchase_orders_updated_at on public.supply_purchase_orders;
create trigger trg_supply_purchase_orders_updated_at
  before update on public.supply_purchase_orders
  for each row execute function public.set_updated_at();

alter table public.supply_purchase_orders enable row level security;

create table if not exists public.supply_purchase_order_lines (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid not null references public.supply_purchase_orders(id) on delete cascade,
  material_id uuid not null references public.warehouse_materials(id) on delete restrict,
  qty_ordered numeric(14, 2) not null check (qty_ordered > 0),
  unit_price  numeric(18, 2) check (unit_price >= 0),
  spec        text,                                           -- quy cách (25x50x1li, 05x539x5mm…)
  qty2        numeric(14, 4),                                 -- số phụ ĐVT kép (tổng kg / tổng m²)
  unit2       text,                                           -- ĐVT phụ (kg, m2…)
  note        text,                                           -- gắn bộ phận SP ("chân trước"…)
  sort_order  int not null default 0
);

create index if not exists supply_po_lines_po_idx
  on public.supply_purchase_order_lines (po_id);
create index if not exists supply_po_lines_material_idx
  on public.supply_purchase_order_lines (material_id);

alter table public.supply_purchase_order_lines enable row level security;

-- Nâng cấp sổ kho: nối FK + loại movement mới --------------------------------------

alter table public.warehouse_movements
  add column if not exists warehouse_id uuid
    references public.warehouses(id) on delete restrict;
alter table public.warehouse_movements
  add column if not exists po_line_id uuid
    references public.supply_purchase_order_lines(id) on delete set null;
alter table public.warehouse_movements
  add column if not exists production_order_id uuid
    references public.production_orders(id) on delete set null;
alter table public.warehouse_movements
  add column if not exists transfer_group uuid;                -- cặp out/in điều chuyển
alter table public.warehouse_movements
  add column if not exists unit_cost numeric(18, 2) check (unit_cost >= 0);  -- GĐ sau, UI ẩn

-- Backfill kho chính cho dữ liệu cũ (idempotent).
update public.warehouse_movements mv
set warehouse_id = w.id
from public.warehouses w
where w.code = 'MAIN' and mv.warehouse_id is null;

-- ref_type thêm 'transfer' (điều chuyển) + 'adjust' (kiểm kê/điều chỉnh — OI-08).
alter table public.warehouse_movements
  drop constraint if exists warehouse_movements_ref_type_check;
alter table public.warehouse_movements
  add constraint warehouse_movements_ref_type_check
  check (ref_type in ('po', 'lsx', 'external', 'daily', 'transfer', 'adjust'));

-- BR-09: xuất theo LSX phải gắn LSX. NOT VALID vì dòng cũ chỉ có ref_no text.
alter table public.warehouse_movements
  drop constraint if exists warehouse_movements_lsx_link_check;
alter table public.warehouse_movements
  add constraint warehouse_movements_lsx_link_check
  check (ref_type <> 'lsx' or production_order_id is not null) not valid;

-- Điều chuyển phải có transfer_group để khớp cặp out/in.
alter table public.warehouse_movements
  drop constraint if exists warehouse_movements_transfer_check;
alter table public.warehouse_movements
  add constraint warehouse_movements_transfer_check
  check (ref_type <> 'transfer' or transfer_group is not null);

create index if not exists warehouse_movements_po_line_idx
  on public.warehouse_movements (po_line_id) where po_line_id is not null;
create index if not exists warehouse_movements_lsx_idx
  on public.warehouse_movements (production_order_id) where production_order_id is not null;

-- BR-08: còn thiếu từng dòng = đặt − đã về (đạt + loại QC), tính từ sổ cái ----------

create or replace view public.supply_po_line_status with (security_invoker = on) as
select
  l.id,
  l.po_id,
  l.material_id,
  l.qty_ordered,
  l.unit_price,
  l.spec,
  l.qty2,
  l.unit2,
  l.note,
  l.sort_order,
  coalesce(sum(mv.qty + mv.qty_rejected), 0)                 as qty_received,
  coalesce(sum(mv.qty_rejected), 0)                          as qty_rejected,
  l.qty_ordered - coalesce(sum(mv.qty + mv.qty_rejected), 0) as qty_missing
from public.supply_purchase_order_lines l
left join public.warehouse_movements mv
  on mv.po_line_id = l.id and mv.direction = 'in'
group by l.id;

-- Màn "trạng thái tổng hợp đơn hàng" (FR-SAL-07) + đầu vào cảnh báo (FR-SAL-09) -----

create or replace view public.v_order_tracking with (security_invoker = on) as
select
  o.id,
  o.code,
  o.customer_id,
  c.name           as customer_name,
  o.customer_po_no,
  o.status,
  o.currency,
  o.due_date,
  q.code           as quote_code,
  po.id            as production_order_id,
  po.code          as lsx_code,
  po.status        as lsx_status,
  po.current_stage,
  po.ship_date,
  (select count(*)
     from public.sales_order_lines ol
     join public.technical_products p on p.id = ol.product_id
    where ol.order_id = o.id and p.bom_status <> 'done')      as lines_bom_pending,
  (select count(*)
     from public.supply_purchase_orders spo
    where spo.production_order_id = po.id
      and spo.status not in ('received', 'cancelled'))        as pos_open,
  o.created_at,
  o.updated_at
from public.sales_orders o
join public.sales_customers c on c.id = o.customer_id
left join public.sales_quotes q on q.id = o.quote_id
left join public.production_orders po on po.sales_order_id = o.id;
