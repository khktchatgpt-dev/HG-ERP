-- Kỹ thuật: HỒ SƠ SẢN PHẨM đầy đủ — định mức tự mô tả, bộ sản phẩm, đóng gói
-- nhiều phương án. Dựng từ 247 file BOM Excel (9.705 dòng định mức / 438 SP).
--
-- QUYẾT ĐỊNH NỀN (user chốt 25/07/2026): hồ sơ sản phẩm ĐỘC LẬP với kho.
-- Định mức ở đây KHÔNG khoá ngoại sang warehouse_materials — nó mô tả vật tư
-- bằng QUY CÁCH (vật liệu + dạng + tiết diện + độ dày), đúng như file BOM gốc,
-- kèm một `material_code` dạng TEXT đã chuẩn hoá (vd 'VT-AL-HOP-20x40x1') để
-- sau này muốn nối sang kho thì join theo mã. Cùng triết lý với 0091 (nhãn khách
-- gõ tự do thay vì FK sang danh mục khách của Kinh doanh).
--
-- KHÔNG đụng `technical_bom_lines` (0012): bảng đó vẫn gắn kho và đang nuôi
-- v_lsx_material_status → nhu cầu mua. Phần cung ứng để nguyên, tính sau.
--
-- Gồm 4 bảng/nhóm thay đổi:
--   1. technical_products      + phân rã mã mới, mã cũ, đặc tính, số tổng hợp
--   2. technical_product_parts  định mức chi tiết, tự mô tả (thay cho BOM 1 cấp)
--   3. technical_product_set_items  bộ sản phẩm gồm những SP con nào
--   4. technical_packing_options / technical_packages  đóng gói nhiều phương án
--
-- RLS: bảng mới ENABLE, no policies (anon chặn, secret key bypass — chuẩn dự án).
-- Idempotent: create table/index if not exists, add column if not exists.
-- Apply: SQL editor hoặc `npx supabase db push`. Sau đó "sync types".

-- ── 1. Hồ sơ sản phẩm: phân rã mã + đặc tính ────────────────────────────────
alter table public.technical_products
  -- Mã cũ (C0201HG-IN). 247 file BOM, 448 ảnh và chứng từ cũ đều gọi theo mã này.
  add column if not exists code_legacy text,
  -- Phân rã mã mới CH000201HG-IN — để lọc/nhóm mà không phải parse chuỗi.
  add column if not exists product_type text,     -- TB CH BN ST SL OT AC
  add column if not exists frame_material text,   -- AL IR IN WO RA GL MX
  add column if not exists serial_no int,
  -- Đặc tính (KHÔNG nhét vào mã — xem 0092 mục 4.3 của kế hoạch).
  add column if not exists is_upholstered boolean not null default false,
  add column if not exists has_glass boolean not null default false,
  add column if not exists is_set boolean not null default false,
  -- Số tổng hợp lấy từ file BOM (người nhập đã tính sẵn trong Excel).
  add column if not exists net_weight_kg numeric(12, 3),
  add column if not exists frame_weight_kg numeric(12, 3),
  add column if not exists frame_length_m numeric(12, 3),
  add column if not exists paint_area_m2 numeric(12, 4),
  add column if not exists part_count int,
  -- Kích thước tổng thể SP (mm) — file BOM ghi theo mm, packing jsonb ghi cm.
  add column if not exists length_mm numeric(10, 1),
  add column if not exists width_mm numeric(10, 1),
  add column if not exists height_mm numeric(10, 1);

do $$ begin
  alter table public.technical_products
    add constraint technical_products_product_type_check
    check (product_type is null or product_type in
      ('TB','CH','BN','ST','SL','OT','AC'));
exception when duplicate_object then null; end $$;

create unique index if not exists technical_products_code_legacy_key
  on public.technical_products (code_legacy) where code_legacy is not null;
create index if not exists technical_products_type_material_idx
  on public.technical_products (product_type, frame_material);

-- ── 2. Định mức chi tiết — TỰ MÔ TẢ, không FK sang kho ──────────────────────
create table if not exists public.technical_product_parts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.technical_products(id) on delete cascade,

  -- Nhóm hạng mục, theo đúng cách file BOM chia.
  group_code text not null default 'FRAME'
    check (group_code in ('FRAME','HARDWARE','CUSHION','WOOD','PACKAGING','OTHER')),
  -- Món nào trong bộ ("Table", "Bank I", "Ottoman"). null = SP đơn.
  set_item_label text,
  part_no int,
  part_name text not null,                 -- Chân, Tay, Nan ngồi…

  -- QUY CÁCH VẬT TƯ (thay cho FK material_id).
  material_code text,                      -- 'VT-AL-HOP-20x40x1' — text, KHÔNG FK
  material_kind text,                      -- AL IR IN WO…
  profile_shape text,                      -- HOP TRON VUONG LA TAM OVAN V C L PF
  profile_code text,                       -- mã khuôn ép: TDHG04…
  dim_a_mm numeric(10, 2),                 -- tiết diện: dày (hộp/la) hoặc Ø
  dim_b_mm numeric(10, 2),                 -- tiết diện: rộng
  wall_thickness_mm numeric(10, 2),        -- độ dày thành; null = đặc
  cut_length_mm numeric(12, 2),            -- chiều dài cắt

  qty numeric(14, 4) not null check (qty > 0),   -- số lượng / 1 SP
  unit text,
  -- Phí hao: LẤY ĐÚNG TỪ FILE BOM, không có thì 0 (user chốt 25/07/2026).
  waste_pct numeric(6, 3) not null default 0 check (waste_pct >= 0),

  -- Đại lượng file Excel đã tính sẵn. Lưu vì công thức (khối lượng riêng theo
  -- từng loại vật liệu) không có trong dữ liệu nên app không tính lại được.
  weight_kg numeric(14, 6),
  total_length_m numeric(14, 4),
  paint_area_m2 numeric(14, 6),
  volume_m3 numeric(14, 6),

  unit_price numeric(14, 2),
  amount numeric(16, 2),
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- KHÔNG unique (product_id, material_code): một SP dùng cùng loại ống cho chân,
-- tay và khung mê với ba chiều dài khác nhau — đó là ba dòng hợp lệ. Đây chính
-- là ràng buộc đã làm hỏng technical_bom_lines (0012) khi nhập từ file BOM.
create index if not exists technical_product_parts_product_idx
  on public.technical_product_parts (product_id, group_code, sort_order);
create index if not exists technical_product_parts_material_code_idx
  on public.technical_product_parts (material_code)
  where material_code is not null;

drop trigger if exists set_updated_at on public.technical_product_parts;
create trigger set_updated_at before update on public.technical_product_parts
  for each row execute function public.set_updated_at();

-- ── 3. Bộ sản phẩm: 194/438 SP là BỘ (bàn + băng + ottoman…) ────────────────
create table if not exists public.technical_product_set_items (
  id uuid primary key default gen_random_uuid(),
  set_product_id uuid not null
    references public.technical_products(id) on delete cascade,
  item_product_id uuid
    references public.technical_products(id) on delete restrict,
  -- Khi món chưa được dựng thành SP riêng thì chỉ có nhãn.
  item_label text not null,                -- "Table", "Bank I", "Ottoman"
  qty numeric(10, 2) not null default 1 check (qty > 0),
  net_weight_kg numeric(12, 3),
  length_mm numeric(10, 1),
  width_mm numeric(10, 1),
  height_mm numeric(10, 1),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists technical_set_items_set_idx
  on public.technical_product_set_items (set_product_id, sort_order);
create index if not exists technical_set_items_item_idx
  on public.technical_product_set_items (item_product_id)
  where item_product_id is not null;

-- ── 4. Đóng gói NHIỀU PHƯƠNG ÁN ────────────────────────────────────────────
-- Dữ liệu thật: S0005HG-AL có 3 phương án (1 thùng xếp 54/cont · 3 thùng xếp 71
-- · 4 thùng xếp 32). Cột packing jsonb cũ chỉ chứa được MỘT bộ kích thước nên
-- giữ nguyên để báo giá đang chạy không vỡ, dữ liệu đầy đủ về hai bảng này.
create table if not exists public.technical_packing_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.technical_products(id) on delete cascade,
  option_no int not null default 1,
  label text,                              -- "Option 2: Không tháo rời"
  cartons_per_set int,
  loading_40hc int,
  is_default boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (product_id, option_no)
);

create table if not exists public.technical_packages (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null
    references public.technical_packing_options(id) on delete cascade,
  package_label text not null,             -- "Table", "Bank I"
  qty int not null default 1 check (qty > 0),
  carton_l_mm numeric(10, 1),
  carton_w_mm numeric(10, 1),
  carton_h_mm numeric(10, 1),
  net_weight_kg numeric(12, 3),
  gross_weight_kg numeric(12, 3),
  sort_order int not null default 0
);
create index if not exists technical_packages_option_idx
  on public.technical_packages (option_id, sort_order);

-- ── RLS: bật, không policy (anon chặn, server secret key bypass) ────────────
alter table public.technical_product_parts      enable row level security;
alter table public.technical_product_set_items  enable row level security;
alter table public.technical_packing_options    enable row level security;
alter table public.technical_packages           enable row level security;
