-- Warehouse: nhập / xuất / tồn (goods movements + stock) — FR-WMS-02..08, BR-10.
--
-- `warehouse_movements` = SỔ CÁI mọi lần nhập/xuất (nguồn sự thật). Tồn kho là
-- tổng hợp realtime qua view `warehouse_stock` — không giữ số tồn denormalized để
-- tránh sai lệch. QC không đạt (qty_rejected) KHÔNG vào tồn (BR-10): cột `qty` là
-- số ĐẠT đã nhập kho, `qty_rejected` chỉ để theo dõi.
--
-- Đơn đặt hàng vật tư (po) / LSX chưa có bảng → tham chiếu bằng ref_type + ref_no
-- (text), sẽ nối FK ở sprint Cung ứng/Sản xuất.
--
-- RLS enabled no-policy (server bypass secret key). View dùng security_invoker.
-- Apply: dán vào SQL editor hoặc `npx supabase db push`, rồi "sync types".

create table if not exists public.warehouse_movements (
  id             uuid primary key default gen_random_uuid(),
  material_id    uuid not null references public.warehouse_materials(id) on delete restrict,
  direction      text not null check (direction in ('in', 'out')),
  qty            numeric(14, 2) not null check (qty > 0),                    -- SL ảnh hưởng tồn (nhập = số ĐẠT)
  qty_rejected   numeric(14, 2) not null default 0 check (qty_rejected >= 0),-- chỉ 'in': QC không đạt, KHÔNG vào tồn
  qc_status      text check (qc_status in ('pass', 'partial', 'fail')),      -- chỉ 'in'
  ref_type       text not null check (ref_type in ('po', 'lsx', 'external', 'daily')),
  ref_no         text,                                                       -- số đơn đặt / mã LSX (FK sau)
  shelf_location text,
  note           text,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists warehouse_movements_material_idx
  on public.warehouse_movements (material_id, created_at desc);
create index if not exists warehouse_movements_dir_idx
  on public.warehouse_movements (direction, created_at desc);

alter table public.warehouse_movements enable row level security;

-- Tồn kho realtime = tổng nhập (đạt) − tổng xuất, theo từng vật tư.
create or replace view public.warehouse_stock with (security_invoker = on) as
select
  m.id            as material_id,
  m.code,
  m.name,
  m.unit,
  m.group_name,
  m.min_stock,
  m.shelf_location,
  m.is_active,
  coalesce(
    sum(case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end),
    0
  )               as on_hand
from public.warehouse_materials m
left join public.warehouse_movements mv on mv.material_id = m.id
group by m.id;
