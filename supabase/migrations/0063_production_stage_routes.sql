-- 0063_production_stage_routes.sql
-- Lộ trình giai đoạn sản xuất theo SP + snapshot theo lệnh (SRS "định hình").
--
-- Nghiệp vụ (user chốt 07/2026): mỗi LOẠI SP đi qua các giai đoạn khác nhau
-- (ghế nhôm: Phôi→Hàn→Sơn…; bàn gỗ khác), do QL Kế hoạch SX ĐỊNH HÌNH. Hiện
-- giai đoạn chỉ là danh mục phẳng dùng chung (0011 catalog production_stage)
-- và LSX có đúng 1 con trỏ current_stage — không mô tả được lộ trình per SP.
--
--   technical_products.stage_route   lộ trình MẶC ĐỊNH của SP (mảng code giai
--                                    đoạn, thứ tự theo danh mục). null = chưa
--                                    định nghĩa → lệnh tự khai.
--   production_order_routes          SNAPSHOT lộ trình per (lệnh × dòng SP) —
--                                    cùng triết lý bảng chi tiết 0038: sửa
--                                    mặc định sau KHÔNG đổi lệnh đang chạy.
--
-- Sổ sản lượng (0039) sẽ validate giai đoạn nhập ∈ lộ trình ở service (không
-- ép FK ở DB — route là jsonb, và lệnh cũ chưa có route vẫn phải nhập được).
--
-- RLS: bảng mới ENABLED, no policies — anon bị chặn, secret key bypass (chuẩn
-- dự án). Idempotent. Apply: `npx supabase db push`. Sau đó "sync types".

-- ── 1. Lộ trình mặc định trên SP ─────────────────────────────────────────────
alter table public.technical_products
  add column if not exists stage_route jsonb;

-- ── 2. Snapshot lộ trình per lệnh × dòng SP ──────────────────────────────────
create table if not exists public.production_order_routes (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  -- Cùng hướng FK với bảng chi tiết (0038): dòng SP đổi → lộ trình dòng đó mất
  -- theo, phải định hình lại (notification order.changed_after_lsx đã cảnh báo).
  order_line_id       uuid not null
                        references public.sales_order_lines(id) on delete cascade,
  stages              jsonb not null default '[]'::jsonb,   -- ["phoi","han","son"]
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint production_order_routes_line_uniq unique (production_order_id, order_line_id)
);

create index if not exists production_order_routes_lsx_idx
  on public.production_order_routes (production_order_id);

drop trigger if exists trg_production_order_routes_updated_at
  on public.production_order_routes;
create trigger trg_production_order_routes_updated_at
  before update on public.production_order_routes
  for each row execute function public.set_updated_at();

alter table public.production_order_routes enable row level security;
