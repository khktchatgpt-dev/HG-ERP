-- Sản xuất: Lệnh sản xuất + tiến độ + spec in LSX (BR-01/02, FR-PROD-01..03, FR-SUP-08).
--
-- BR-01 (đơn ↔ LSX 1-1) ép ngay ở DB: sales_order_id NOT NULL UNIQUE.
-- BR-02: dòng sản phẩm của LSX = sales_order_lines (dùng chung, không nhân bản);
-- mọi thay đổi đơn sau khi phát LSX đã có sales_order_changes ghi vết.
--
-- production_order_line_specs: theo mẫu in LSX thật (docs/db-design-inputs-analysis.md
-- §1.4) — mỗi dòng SP có spec sản xuất riêng để in (máy/dây màu, nệm, sơn, đóng
-- gói, ghi chú, lưu ý quan trọng). Để jsonb vì bộ cột đổi theo loại SP
-- (ghế dây / bàn kính / sofa nệm). Ai nhập ở bước nào: OI-11, chưa chốt.
--
-- current_stage / production_progress.stage: code catalog_items type
-- 'production_stage' (không FK cứng — quy ước chung §3 db-design-erp.md).
-- GĐ3 thêm worker_id/qty/hours vào production_progress (chỉ thêm cột).
--
-- RLS: ENABLED, NO policies trên mọi bảng (anon bị chặn, server bypass).
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

create table if not exists public.production_orders (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,                     -- LSX-2026-0001
  sales_order_id    uuid not null unique                      -- ⭐ BR-01: 1-1 ép ở DB
                      references public.sales_orders(id) on delete restrict,
  status            text not null default 'issued'
                      check (status in ('issued', 'in_progress', 'completed')),
  current_stage     text,                                     -- code production_stage (FR-PROD-01)
  ship_date         date,                                     -- thời gian xuất in trên LSX
  container_summary text,                                     -- vd '3 x 40''HC'
  issued_by         uuid references public.users(id) on delete set null,  -- GĐ xác nhận phát (FR-SAL-06)
  issued_at         timestamptz,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists production_orders_status_idx
  on public.production_orders (status);

drop trigger if exists trg_production_orders_updated_at on public.production_orders;
create trigger trg_production_orders_updated_at
  before update on public.production_orders
  for each row execute function public.set_updated_at();

alter table public.production_orders enable row level security;

-- Log chuyển giai đoạn (FR-SUP-08, FR-PROD-01) ----------------------------------

create table if not exists public.production_progress (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  stage               text not null,                          -- code production_stage
  action              text not null default 'done' check (action in ('start', 'done')),
  note                text,
  updated_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists production_progress_po_idx
  on public.production_progress (production_order_id, created_at desc);

alter table public.production_progress enable row level security;

-- Spec sản xuất per dòng SP để in LSX (mẫu in LAURA) -----------------------------

create table if not exists public.production_order_line_specs (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  order_line_id       uuid not null references public.sales_order_lines(id) on delete cascade,
  specs               jsonb not null default '{}'::jsonb,     -- {may, nem, son, dong_goi, …}
  note                text,                                   -- cột Note trên mẫu in
  important_note      text,                                   -- cột "Lưu ý quan trọng"
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (production_order_id, order_line_id)
);

drop trigger if exists trg_production_order_line_specs_updated_at
  on public.production_order_line_specs;
create trigger trg_production_order_line_specs_updated_at
  before update on public.production_order_line_specs
  for each row execute function public.set_updated_at();

alter table public.production_order_line_specs enable row level security;
