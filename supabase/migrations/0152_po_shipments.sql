-- 0152 — NCC XÁC NHẬN + ĐỢT GIAO cho đơn đặt vật tư (docs/plan-po-giao-nhan.md GĐ1).
--
-- BỐI CẢNH: NCC không đăng nhập hệ thống — "NCC xác nhận" là NHÂN VIÊN CUNG ỨNG
-- ghi lại cam kết sau cuộc gọi/Zalo (ai hứa, hứa bao nhiêu, giao ngày nào).
-- Trước 0152, advance('confirmed') chỉ lật cờ, không lưu nội dung cam kết; cả
-- đơn một ô expected_at nên không tả được "gỗ 2.000 kg chia 2 đợt 19/08+22/08".
--
--   supply_purchase_orders + confirmed_at/confirmed_note — mốc & nội dung cam kết.
--   supply_po_shipments        — mỗi ĐỢT giao một dòng (ngày hẹn, cách giao, nơi nhận).
--   supply_po_shipment_lines   — đợt gồm những dòng đơn nào, mỗi dòng bao nhiêu.
--
-- Trạng thái đợt: planned (hẹn) → arrived (xe tới cổng) → received (Kho đã lập
-- PNK nhận đủ phần của đợt) | cancelled. Trạng thái PO KHÔNG đổi luật: partial/
-- received vẫn do sổ kho quyết (BR-08, supply_po_line_status) — đợt chỉ là kế
-- hoạch để đối chiếu, không phải nguồn sự thật về tồn.
--
-- RLS: ENABLED, NO policies (anon chặn, server secret key bypass — chuẩn dự án).
-- Idempotent. Apply: SQL editor / MCP apply_migration (CLI lỗi IPv6). Sau đó
-- "sync types" (types đã được chép tay đúng shape trong lúc chờ apply).

alter table public.supply_purchase_orders
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_note text;

create table if not exists public.supply_po_shipments (
  id            uuid primary key default gen_random_uuid(),
  po_id         uuid not null references public.supply_purchase_orders(id) on delete cascade,
  seq           int  not null,
  expected_date date not null,
  method        text,
  place         text,
  note          text,
  status        text not null default 'planned'
                check (status in ('planned', 'arrived', 'received', 'cancelled')),
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (po_id, seq)
);

create table if not exists public.supply_po_shipment_lines (
  id          uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.supply_po_shipments(id) on delete cascade,
  po_line_id  uuid not null references public.supply_purchase_order_lines(id) on delete cascade,
  qty         numeric(14, 2) not null check (qty > 0),
  unique (shipment_id, po_line_id)
);

create index if not exists supply_po_shipments_po_idx
  on public.supply_po_shipments (po_id, expected_date);
create index if not exists supply_po_shipments_date_idx
  on public.supply_po_shipments (expected_date)
  where status in ('planned', 'arrived');
create index if not exists supply_po_shipment_lines_line_idx
  on public.supply_po_shipment_lines (po_line_id);

drop trigger if exists supply_po_shipments_updated_at on public.supply_po_shipments;
create trigger supply_po_shipments_updated_at
  before update on public.supply_po_shipments
  for each row execute function public.set_updated_at();

alter table public.supply_po_shipments enable row level security;
alter table public.supply_po_shipment_lines enable row level security;
