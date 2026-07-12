-- Item master chuẩn ERP (1/4): cây nhóm vật tư phân cấp — docs/thiet-ke-item-master-erp.md §3.2.
--
-- Thay dần `warehouse_materials.group_name` (text tự do) bằng nhóm có cấu trúc,
-- phân cấp cha–con (Kim loại → Ống sắt, ...). Seed sẵn bộ nhóm cho nội thất kim
-- loại (dòng HALI), mở sẵn nhánh Gỗ/Vải/Kính cho dòng sản phẩm tương lai.
-- `group_name` cũ GIỮ NGUYÊN (deprecated) để tương thích — dữ liệu dời dần.
--
-- RLS: ENABLED, NO policies — anon bị chặn, secret key server bypass.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó SYNC TYPES (bảng mới).

create table if not exists public.item_categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.item_categories(id) on delete set null,
  code       text not null unique,                     -- 'KIM_LOAI', 'KL_ONG'…
  name       text not null check (char_length(name) between 1 and 120),
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists item_categories_parent_idx
  on public.item_categories (parent_id);

drop trigger if exists trg_item_categories_updated_at on public.item_categories;
create trigger trg_item_categories_updated_at
  before update on public.item_categories
  for each row execute function public.set_updated_at();

alter table public.item_categories enable row level security;

-- Seed nhóm cấp 1 -----------------------------------------------------------------
insert into public.item_categories (code, name, sort_order) values
  ('KIM_LOAI',   'Kim loại',      10),
  ('HOAN_THIEN', 'Hoàn thiện',    20),
  ('PHU_KIEN',   'Phụ kiện',      30),
  ('BAO_BI',     'Bao bì',        40),
  ('GO_VAN',     'Gỗ & ván',      50),
  ('VAI_NEM',    'Vải & nệm',     60),
  ('KINH_GUONG', 'Kính & gương',  70)
on conflict (code) do nothing;

-- Seed nhóm cấp 2 (nối cha qua code) ----------------------------------------------
insert into public.item_categories (parent_id, code, name, sort_order)
select p.id, c.code, c.name, c.sort_order
from (values
  ('KIM_LOAI',   'KL_ONG',      'Ống sắt',          11),
  ('KIM_LOAI',   'KL_THANH',    'Thanh/hộp sắt',    12),
  ('KIM_LOAI',   'KL_NHOM',     'Nhôm định hình',   13),
  ('KIM_LOAI',   'KL_TON',      'Tôn tấm',          14),
  ('KIM_LOAI',   'KL_INOX',     'Inox',             15),
  ('HOAN_THIEN', 'HT_SON_TD',   'Sơn tĩnh điện',    21),
  ('HOAN_THIEN', 'HT_SON_DAU',  'Sơn dầu',          22),
  ('HOAN_THIEN', 'HT_DUNG_MOI', 'Dung môi',         23),
  ('HOAN_THIEN', 'HT_KEO',      'Keo',              24),
  ('HOAN_THIEN', 'HT_NHAM',     'Giấy nhám',        25),
  ('HOAN_THIEN', 'HT_DA_CAT',   'Đá cắt/mài',       26),
  ('PHU_KIEN',   'PK_OC_VIT',   'Ốc vít – tán',     31),
  ('PHU_KIEN',   'PK_CHAN_KE',  'Chân đế – ke góc', 32),
  ('PHU_KIEN',   'PK_BANH_XE',  'Bánh xe',          33),
  ('PHU_KIEN',   'PK_TAY_NAM',  'Tay nắm',          34),
  ('PHU_KIEN',   'PK_NUT_BIT',  'Nút bịt',          35),
  ('BAO_BI',     'BB_CARTON',   'Carton',           41),
  ('BAO_BI',     'BB_PE',       'Màng PE',          42),
  ('BAO_BI',     'BB_XOP',      'Xốp',              43),
  ('BAO_BI',     'BB_DAY_DAI',  'Dây đai',          44)
) as c(parent_code, code, name, sort_order)
join public.item_categories p on p.code = c.parent_code
on conflict (code) do nothing;
