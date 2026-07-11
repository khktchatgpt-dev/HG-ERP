-- Bảng chi tiết (component) theo LSX — bước 1 SRS sản xuất chi tiết
-- (docs/srs-san-xuat-chi-tiet.md FR-MD-02/03, FR-PL-02/03; plan-lsx-components).
--
-- QUYẾT ĐỊNH THIẾT KẾ (user chốt 07/2026): chi tiết do KẾ HOẠCH NHẬP TAY,
-- đối chiếu file BOM — KHÔNG lấy sống từ technical_bom_lines (BOM có thể chưa
-- có hoặc sai). Mỗi LSX giữ SNAPSHOT riêng: sửa BOM sau không đổi lệnh đang
-- chạy (NFR-MT-02). Đại lượng dẫn xuất (tổng cần, kg, số cây) KHÔNG lưu cứng
-- — tính ở service (src/lib/component-needs.ts, xử lý chia 0 an toàn).
--
-- RLS: enable, KHÔNG policy — anon bị chặn, secret key server bypass.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó SYNC TYPES (bảng mới).

create table if not exists public.production_order_components (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  -- Chi tiết thuộc dòng SP nào trong lệnh. Cascade: sửa đơn thay dòng SP →
  -- chi tiết của dòng đó mất theo (SP đổi thì phải nhập lại — chấp nhận,
  -- notification order.changed_after_lsx đã cảnh báo).
  order_line_id       uuid not null
                        references public.sales_order_lines(id) on delete cascade,
  cluster             text,                                  -- cụm: "CỤM TỰA"
  name                text not null,                         -- chi tiết: "TAY+TỰA"
  material_id         uuid references public.warehouse_materials(id) on delete restrict,
  material_type       text,                                  -- TRÒN/ĐẶC/HỘP…
  spec_thickness_mm   numeric(10, 2) check (spec_thickness_mm > 0),
  spec_width_mm       numeric(10, 2) check (spec_width_mm > 0),
  spec_length_mm      numeric(10, 2) check (spec_length_mm > 0),
  qty_per_unit        numeric(14, 4) not null check (qty_per_unit > 0), -- CT/SP
  dm_kg               numeric(14, 4) check (dm_kg >= 0),     -- kg vật tư / 1 chi tiết
  pcs_per_bar         numeric(14, 4) check (pcs_per_bar > 0),-- số chi tiết / 1 cây
  sort_order          int not null default 0,
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists production_order_components_lsx_idx
  on public.production_order_components (production_order_id);
create index if not exists production_order_components_line_idx
  on public.production_order_components (order_line_id);

drop trigger if exists trg_production_order_components_updated_at
  on public.production_order_components;
create trigger trg_production_order_components_updated_at
  before update on public.production_order_components
  for each row execute function public.set_updated_at();

alter table public.production_order_components enable row level security;
