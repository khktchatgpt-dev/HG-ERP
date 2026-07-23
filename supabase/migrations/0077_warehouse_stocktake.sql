-- 0077_warehouse_stocktake.sql — Kiểm kê kho (bước 3 định hướng lại Kho)
--
-- Bảng warehouse_stocktake_lines: BIÊN BẢN kiểm kê đầy đủ — mọi vật tư đã đếm
-- (kể cả khớp sổ), gắn vào phiếu warehouse_docs kind='stocktake' (enum + mã KK
-- đã khai sẵn từ 0017). Dòng LỆCH sổ sinh thêm movement ref_type='adjust'
-- (enum sẵn từ 0015) cùng doc_id — tồn sau kiểm = số đếm thực tế, sổ cái vẫn
-- là nguồn sự thật duy nhất (view warehouse_stock không đổi).
--
--   system_qty  = tồn sổ tại thời điểm ghi phiếu (server đọc lại, không tin client)
--   counted_qty = số đếm thực tế
--   diff        = counted_qty − system_qty (lưu thẳng để in biên bản, không generated
--                 vì cần idempotent re-run đơn giản)
--
-- RLS: ENABLED, NO policies (anon bị chặn, secret key server bypass) — như mọi bảng.
-- Idempotent: create table if not exists; index if not exists.

create table if not exists public.warehouse_stocktake_lines (
  id           uuid primary key default gen_random_uuid(),
  doc_id       uuid not null references public.warehouse_docs(id) on delete cascade,
  material_id  uuid not null references public.warehouse_materials(id) on delete restrict,
  system_qty   numeric(18, 4) not null,
  counted_qty  numeric(18, 4) not null check (counted_qty >= 0),
  diff         numeric(18, 4) not null,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists warehouse_stocktake_lines_doc_idx
  on public.warehouse_stocktake_lines (doc_id);
create index if not exists warehouse_stocktake_lines_material_idx
  on public.warehouse_stocktake_lines (material_id);

alter table public.warehouse_stocktake_lines enable row level security;

comment on table public.warehouse_stocktake_lines is
  'Biên bản kiểm kê: mọi vật tư đã đếm của 1 phiếu KK (kind=stocktake). Dòng lệch sinh movement adjust cùng doc_id (0077).';
