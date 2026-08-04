-- LỆNH SẢN XUẤT GỘP NHIỀU ĐƠN HÀNG — bỏ BR-01 ("1 đơn = 1 LSX").
--
-- Chủ dự án chốt 04/08/2026: xưởng chạy một lệnh cho NHIỀU đơn cùng lúc (gộp
-- cùng mã SP/công đoạn cho hiệu quả). Ràng buộc mới:
--   · quan hệ N đơn : 1 LSX — mỗi đơn thuộc TỐI ĐA một lệnh;
--   · mọi đơn trong một lệnh phải CÙNG MỘT KHÁCH HÀNG (ép ở service, và ở DB
--     bằng `production_orders.customer_id` + trigger đối chiếu khi gắn đơn);
--   · thêm/bớt đơn được phép khi lệnh chưa hoàn thành.
--
-- Đổi chiều khoá ngoại: bỏ `production_orders.sales_order_id` (NOT NULL UNIQUE
-- — chính là chỗ ép 1-1), thay bằng `sales_orders.production_order_id`. Đặt FK
-- ở phía "nhiều" là dạng chuẩn của N:1 và giữ luôn tính chất "một đơn tối đa
-- một lệnh" mà không cần bảng nối. `on delete set null` để xoá lệnh (nếu có)
-- không kéo đơn hàng đi theo.
--
-- `production_orders.customer_id`: khách của lệnh, backfill từ đơn cũ. Có nó thì
-- lệnh vẫn biết mình của khách nào ngay cả lúc chưa/không còn đơn nào gắn vào,
-- và là mốc để chặn gộp nhầm khách.
--
-- Hai view phụ thuộc `po.sales_order_id` phải dựng lại:
--   · v_order_tracking — nay join `po on po.id = o.production_order_id`. Tiến độ
--     `jobs_total/jobs_done` đổi sang ĐẾM THEO ĐƠN (lọc job qua dòng SP của đơn
--     đó) thay vì đếm cả lệnh: một lệnh gộp 3 đơn thì mỗi đơn phải thấy phần
--     việc của riêng mình, không phải tổng của cả lệnh. `pos_open` giữ nguyên
--     mức LỆNH (PO vật tư mua gộp cho cả lệnh, không tách được về từng đơn).
--   · v_lsx_material_status — nhu cầu vật tư của lệnh nay là tổng dòng SP của
--     MỌI đơn thuộc lệnh. Bản dựng lại lấy định mức từ `technical_product_parts`
--     (nguồn định mức duy nhất từ 0096), không phải `technical_bom_lines` cũ.
--
-- RLS: không tạo bảng mới nên không đổi tư thế (mọi bảng đã enable RLS, no
-- policies — anon bị chặn, secret key bypass). Hai view giữ `security_invoker = on`.
--
-- Idempotent: add column if not exists / drop ... if exists; khối backfill chỉ
-- chạy khi cột cũ còn, nên chạy lại lần hai là no-op.

-- ── 1. Drop view phụ thuộc (postgres chặn drop cột khi còn view) ─────────────
drop view if exists public.v_order_tracking;
drop view if exists public.v_lsx_material_status;

-- ── 2. Cột mới ──────────────────────────────────────────────────────────────
alter table public.sales_orders
  add column if not exists production_order_id uuid
    references public.production_orders(id) on delete set null;

create index if not exists sales_orders_production_order_idx
  on public.sales_orders (production_order_id);

alter table public.production_orders
  add column if not exists customer_id uuid
    references public.sales_customers(id) on delete restrict;

-- ── 3. Backfill từ quan hệ 1-1 cũ, rồi bỏ cột cũ ─────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'production_orders'
       and column_name  = 'sales_order_id'
  ) then
    execute $sql$
      update public.sales_orders o
         set production_order_id = po.id
        from public.production_orders po
       where po.sales_order_id = o.id
         and o.production_order_id is distinct from po.id
    $sql$;
    execute $sql$
      update public.production_orders po
         set customer_id = o.customer_id
        from public.sales_orders o
       where o.id = po.sales_order_id
         and po.customer_id is null
    $sql$;
  end if;
end $$;

alter table public.production_orders
  drop column if exists sales_order_id;

-- Chỉ siết NOT NULL khi đã đủ dữ liệu (lệnh mồ côi ở môi trường lạ thì bỏ qua,
-- không làm hỏng cả migration).
do $$
begin
  if not exists (select 1 from public.production_orders where customer_id is null) then
    alter table public.production_orders alter column customer_id set not null;
  end if;
end $$;

comment on column public.sales_orders.production_order_id is
  'LSX đang sản xuất đơn này (N đơn : 1 LSX, 0113). NULL = chưa phát lệnh.';
comment on column public.production_orders.customer_id is
  'Khách hàng của lệnh — mọi đơn gộp vào lệnh phải cùng khách này (0113).';

-- ── 4. Chặn gộp nhầm khách ở tầng DB ────────────────────────────────────────
create or replace function public.assert_lsx_same_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lsx_customer uuid;
begin
  if new.production_order_id is null then
    return new;
  end if;
  select customer_id into lsx_customer
    from public.production_orders
   where id = new.production_order_id;
  if lsx_customer is not null and lsx_customer <> new.customer_id then
    raise exception 'Đơn % khác khách hàng của lệnh sản xuất', new.code
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_sales_orders_lsx_same_customer on public.sales_orders;
create trigger trg_sales_orders_lsx_same_customer
  before insert or update of production_order_id, customer_id on public.sales_orders
  for each row execute function public.assert_lsx_same_customer();

-- ── 5. Dựng lại v_order_tracking (tiến độ đếm theo TỪNG ĐƠN) ────────────────
create view public.v_order_tracking with (security_invoker = on) as
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
  po.priority      as lsx_priority,
  po.ship_date,
  (select count(*)
     from public.production_jobs j
     join public.sales_order_lines ol on ol.id = j.order_line_id
    where j.production_order_id = po.id
      and ol.order_id = o.id)                                 as jobs_total,
  (select count(*)
     from public.production_jobs j
     join public.sales_order_lines ol on ol.id = j.order_line_id
    where j.production_order_id = po.id
      and ol.order_id = o.id
      and j.status = 'done')                                  as jobs_done,
  (select count(*)
     from public.sales_order_lines ol
     join public.technical_products p on p.id = ol.product_id
    where ol.order_id = o.id and p.bom_status <> 'done')      as lines_bom_pending,
  (select count(*)
     from public.supply_purchase_orders spo
    where spo.production_order_id = po.id
      and spo.status not in ('received', 'cancelled'))        as pos_open,
  o.deposit_percent,
  o.payment_method,
  (select coalesce(sum(ol.qty * ol.unit_price), 0)
     from public.sales_order_lines ol
    where ol.order_id = o.id)                                 as order_value,
  (select count(*)
     from public.sales_order_lines ol
    where ol.order_id = o.id)                                 as line_count,
  o.created_at,
  o.updated_at
from public.sales_orders o
join public.sales_customers c on c.id = o.customer_id
left join public.sales_quotes q on q.id = o.quote_id
left join public.production_orders po on po.id = o.production_order_id;

-- ── 6. Dựng lại v_lsx_material_status (nhu cầu = mọi đơn của lệnh) ──────────
create view public.v_lsx_material_status with (security_invoker = on) as
with need as (
  select
    po.id                    as production_order_id,
    m.id                     as material_id,
    sum(pp.qty * ol.qty)     as qty_needed
  from public.production_orders po
  join public.sales_orders so
    on so.production_order_id = po.id
  join public.sales_order_lines ol
    on ol.order_id = so.id
  join public.technical_product_parts pp
    on pp.product_id = ol.product_id
  -- nối bằng MÃ TEXT, không phải khoá ngoại (xem 0096)
  join public.warehouse_materials m
    on m.code = pp.material_code
  where pp.material_code is not null
  group by po.id, m.id
),
issued as (
  select
    mv.production_order_id,
    mv.material_id,
    sum(mv.qty) as qty_issued
  from public.warehouse_movements mv
  where mv.direction = 'out' and mv.production_order_id is not null
  group by mv.production_order_id, mv.material_id
)
select
  coalesce(n.production_order_id, i.production_order_id) as production_order_id,
  coalesce(n.material_id, i.material_id)                 as material_id,
  m.code                                                 as material_code,
  m.name                                                 as material_name,
  m.unit,
  coalesce(n.qty_needed, 0)                              as qty_needed,
  coalesce(i.qty_issued, 0)                              as qty_issued,
  coalesce(n.qty_needed, 0) - coalesce(i.qty_issued, 0)  as qty_remaining
from need n
full outer join issued i
  on i.production_order_id = n.production_order_id and i.material_id = n.material_id
join public.warehouse_materials m
  on m.id = coalesce(n.material_id, i.material_id);
