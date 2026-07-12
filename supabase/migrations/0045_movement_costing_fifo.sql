-- Item master chuẩn ERP (4/4): định giá tồn kho FIFO — docs/thiet-ke-item-master-erp.md §6.
--
-- Giải G2: tính GIÁ TRỊ TỒN KHO & GIÁ VỐN XUẤT theo FIFO (nhập trước xuất trước).
-- Mỗi lần NHẬP mở một LỚP GIÁ (stock_cost_layers) với qty + đơn giá; mỗi lần XUẤT
-- tiêu thụ các lớp cũ nhất trước, giá vốn xuất = Σ(SL lấy × đơn giá lớp). Không
-- theo dõi lô/hạn dùng vật lý (đã chốt) — lớp giá chỉ phục vụ định giá.
-- Sổ cái warehouse_movements thêm unit_cost/total_cost (giá vốn thực của dòng).
--
-- Hàm fifo_receipt/fifo_issue là KHỐI DỰNG cho service ghi phiếu: gọi SAU khi
-- insert movement, trong CÙNG transaction. fifo_issue khóa lớp giá (for update)
-- chống race. Dữ liệu cũ chưa có lớp giá → phần thiếu tính giá 0 (không chặn xuất).
--
-- RLS: stock_cost_layers ENABLED no-policy; view security_invoker = on.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó SYNC TYPES.

-- 1) Cột giá vốn trên sổ cái ------------------------------------------------------
-- unit_cost đã có sẵn từ 0015 (numeric(18,2), "GĐ sau") — không khai lại.
-- Chỉ bổ sung total_cost = giá vốn thực của cả dòng (FIFO tính khi ghi).
alter table public.warehouse_movements
  add column if not exists total_cost numeric(18, 2) check (total_cost is null or total_cost >= 0);

-- 2) Lớp giá FIFO (nguồn sự thật của giá vốn tồn) ---------------------------------
create table if not exists public.stock_cost_layers (
  id            uuid primary key default gen_random_uuid(),
  material_id   uuid not null references public.warehouse_materials(id) on delete restrict,
  movement_id   uuid not null references public.warehouse_movements(id) on delete cascade,
  qty_in        numeric(14, 2) not null check (qty_in > 0),        -- SL nhập (base_unit)
  qty_remaining numeric(14, 2) not null check (qty_remaining >= 0),-- còn lại chưa xuất
  unit_cost     numeric(14, 2) not null check (unit_cost >= 0),    -- giá vốn / base_unit
  created_at    timestamptz not null default now()
);

-- Thứ tự FIFO: cũ nhất trước, chỉ lớp còn hàng.
create index if not exists stock_cost_layers_fifo_idx
  on public.stock_cost_layers (material_id, created_at, id) where qty_remaining > 0;

alter table public.stock_cost_layers enable row level security;

-- 3) NHẬP: mở lớp giá + ghi giá vào movement --------------------------------------
create or replace function public.fifo_receipt(
  p_material_id uuid,
  p_movement_id uuid,
  p_qty         numeric,
  p_unit_cost   numeric
) returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_qty is null or p_qty <= 0 then return; end if;

  insert into public.stock_cost_layers
    (material_id, movement_id, qty_in, qty_remaining, unit_cost)
  values
    (p_material_id, p_movement_id, p_qty, p_qty, coalesce(p_unit_cost, 0));

  update public.warehouse_movements
    set unit_cost  = coalesce(p_unit_cost, 0),
        total_cost = coalesce(p_unit_cost, 0) * p_qty
  where id = p_movement_id;
end;
$$;

-- 4) XUẤT: tiêu thụ lớp giá cũ nhất trước, trả giá vốn xuất -----------------------
create or replace function public.fifo_issue(
  p_material_id uuid,
  p_movement_id uuid,
  p_qty         numeric
) returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_remaining  numeric := p_qty;
  v_total_cost numeric := 0;
  v_take       numeric;
  r            record;
begin
  if p_qty is null or p_qty <= 0 then return 0; end if;

  for r in
    select id, qty_remaining, unit_cost
    from public.stock_cost_layers
    where material_id = p_material_id and qty_remaining > 0
    order by created_at, id
    for update
  loop
    exit when v_remaining <= 0;
    v_take       := least(r.qty_remaining, v_remaining);
    v_total_cost := v_total_cost + v_take * r.unit_cost;
    update public.stock_cost_layers
      set qty_remaining = qty_remaining - v_take
    where id = r.id;
    v_remaining := v_remaining - v_take;
  end loop;
  -- v_remaining > 0 nghĩa là thiếu lớp giá (dữ liệu cũ) → phần đó giá vốn 0.

  update public.warehouse_movements
    set total_cost = v_total_cost,
        unit_cost  = case when p_qty > 0 then round(v_total_cost / p_qty, 2) else 0 end
  where id = p_movement_id;

  return v_total_cost;
end;
$$;

-- 5) Giá trị tồn kho realtime (FIFO) ---------------------------------------------
create or replace view public.v_stock_valuation with (security_invoker = on) as
select
  m.id                                              as material_id,
  m.code,
  m.name,
  m.base_unit,
  coalesce(sum(l.qty_remaining), 0)                 as qty_on_hand,
  coalesce(sum(l.qty_remaining * l.unit_cost), 0)   as stock_value,
  case when coalesce(sum(l.qty_remaining), 0) > 0
    then round(sum(l.qty_remaining * l.unit_cost) / sum(l.qty_remaining), 2)
    else 0 end                                      as avg_unit_cost
from public.warehouse_materials m
left join public.stock_cost_layers l
  on l.material_id = m.id and l.qty_remaining > 0
group by m.id;
