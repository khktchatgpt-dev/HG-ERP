-- Kinh doanh: GIAO HÀNG TỪNG PHẦN theo dòng đơn (thay sổ Excel "order HG").
--
-- Sổ theo dõi thật của Sales (order HG 2026-2027.xlsx) chạy theo dòng:
--   ART.No | QUANTITY | SHIPMENT (tuần, vd w37.26) | ĐÃ XUẤT | LEFT
-- App mới có cờ delivered toàn đơn — không trả lời được "đơn này còn phải giao
-- bao nhiêu, tuần nào". Bổ sung:
--   1) sales_order_lines.ship_week — tuần giao KẾ HOẠCH từng dòng ('w37.26',
--      text tự do vì khách ghi đủ kiểu: 'w09.26', 'W8.2024', 'ETD theo ORT').
--   2) sales_order_shipments — mỗi lần THỰC XUẤT một dòng ghi một bản ghi
--      (append; đã xuất = Σ qty theo order_line_id, còn lại = qty − đã xuất).
--      Gắn cả order_id để đọc theo đơn không phải join qua lines.
--
-- RLS: ENABLED, NO policies (anon chặn, server secret key bypass — chuẩn dự án).
-- Idempotent. Apply: `npx supabase db push` / SQL editor. Sau đó "sync types".

alter table public.sales_order_lines
  add column if not exists ship_week text;

create table if not exists public.sales_order_shipments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.sales_orders(id) on delete cascade,
  order_line_id uuid not null references public.sales_order_lines(id) on delete cascade,
  qty           numeric(14, 2) not null check (qty > 0),
  shipped_at    date not null default current_date,
  note          text,                                   -- số cont / booking / ghi chú đợt
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists sales_order_shipments_order_idx
  on public.sales_order_shipments (order_id, shipped_at desc);
create index if not exists sales_order_shipments_line_idx
  on public.sales_order_shipments (order_line_id);

alter table public.sales_order_shipments enable row level security;
