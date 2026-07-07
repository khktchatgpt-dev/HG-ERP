-- Kho: phiếu chứng từ (header) + view nhu cầu vật tư theo LSX + 2 vá bảo mật.
--
-- 1) warehouse_docs: PHIẾU nhập/xuất/điều chuyển/kiểm kê — gom nhiều dòng
--    movements dưới một số chứng từ (PNK-/PXK-/DCK-/KK-YYYY-NNNN qua
--    next_doc_code) để in mẫu 01-VT/02-VT (người giao/nhận, lý do, chữ ký).
--    SỔ CÁI vẫn là warehouse_movements (không đổi triết lý 0010) — docs chỉ là
--    header trình bày; movements.doc_id nullable để dữ liệu cũ hợp lệ.
-- 2) v_lsx_material_status: cần theo BOM × SL đơn − đã xuất theo LSX (gap G-2,
--    FR-WMS-05 "đơn cần 4 ốc → đã xuất bao nhiêu").
-- 3) Vá bảo mật tồn đọng: settings bật RLS (0004 từng tắt — server dùng secret
--    key nên không ảnh hưởng; anon key không còn đọc/ghi được);
--    v_task_summary thêm security_invoker (advisor flag SECURITY DEFINER).
--
-- RLS: ENABLED, NO policies (anon chặn, server secret key bypass); view
-- security_invoker = on.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

-- 1) Phiếu kho ------------------------------------------------------------------

create table if not exists public.warehouse_docs (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,                    -- PNK-2026-0001 (next_doc_code)
  kind         text not null check (kind in ('receipt', 'issue', 'transfer', 'stocktake')),
  doc_date     date not null default current_date,
  counterparty text,                                    -- người giao/nhận (mẫu 01/02-VT)
  reason       text,                                    -- lý do xuất / diễn giải phiếu
  note         text,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists warehouse_docs_kind_idx
  on public.warehouse_docs (kind, doc_date desc);

drop trigger if exists trg_warehouse_docs_updated_at on public.warehouse_docs;
create trigger trg_warehouse_docs_updated_at
  before update on public.warehouse_docs
  for each row execute function public.set_updated_at();

alter table public.warehouse_docs enable row level security;

alter table public.warehouse_movements
  add column if not exists doc_id uuid
    references public.warehouse_docs(id) on delete set null;

create index if not exists warehouse_movements_doc_idx
  on public.warehouse_movements (doc_id) where doc_id is not null;

-- 2) Nhu cầu vật tư theo LSX: cần (BOM × SL đơn) − đã xuất theo LSX -------------

create or replace view public.v_lsx_material_status with (security_invoker = on) as
with need as (
  select
    po.id            as production_order_id,
    bl.material_id,
    sum(bl.qty_per_unit * ol.qty) as qty_needed
  from public.production_orders po
  join public.sales_order_lines ol on ol.order_id = po.sales_order_id
  join public.technical_bom_lines bl on bl.product_id = ol.product_id
  group by po.id, bl.material_id
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

-- 3) Vá bảo mật tồn đọng ---------------------------------------------------------

-- settings: 0004 từng disable RLS — bật lại cho khớp posture toàn dự án.
alter table public.settings enable row level security;

-- v_task_summary: thiếu security_invoker từ 0002/0004.
alter view public.v_task_summary set (security_invoker = on);
