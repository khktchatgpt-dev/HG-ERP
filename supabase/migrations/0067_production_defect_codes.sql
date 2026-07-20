-- 0067_production_defect_codes.sql
-- Danh mục NGUYÊN NHÂN LỖI chuẩn hoá (sổ sản lượng 07/2026) + cột defect_reason.
--
-- Không nhét vào catalog_items: check constraint `type` (0011) + thiếu chiều
-- stage_code (lỗi lọc theo công đoạn — tổ sơn chỉ thấy lỗi sơn). stage_code
-- null = áp dụng mọi công đoạn. Sổ lưu CODE (bất biến khi đổi label — cùng
-- triết lý catalog "tham chiếu bằng code, không FK cứng").
--
-- production_output_entries.defect_reason: nullable — bản ghi CŨ không lý do
-- vẫn hợp lệ; rule "phế > 0 phải có lý do" chỉ áp cho bản ghi MỚI (service).
--
-- RLS: ENABLED, no policies — anon chặn, secret key bypass (chuẩn dự án).
-- Idempotent. Apply: `npx supabase db push`. Sau đó "sync types".

create table if not exists public.production_defect_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  label      text not null,
  stage_code text,                -- code catalog production_stage; null = mọi công đoạn
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_production_defect_codes_updated_at
  on public.production_defect_codes;
create trigger trg_production_defect_codes_updated_at
  before update on public.production_defect_codes
  for each row execute function public.set_updated_at();

alter table public.production_defect_codes enable row level security;

alter table public.production_output_entries
  add column if not exists defect_reason text;

-- Seed theo các công đoạn hiện có (phoi/han/son/mai/hoan_thien — 0011)
insert into public.production_defect_codes (code, label, stage_code, sort_order) values
  ('hut_kich_thuoc',    'Hụt kích thước',      null,          1),
  ('mop_meo',           'Móp méo',             null,          2),
  ('tray_xuoc',         'Trầy xước',           null,          3),
  ('khac',              'Nguyên nhân khác',    null,         99),
  ('phoi_cat_sai',      'Cắt sai kích thước',  'phoi',       10),
  ('phoi_ba_via',       'Ba via / cạnh sắc',   'phoi',       11),
  ('han_nut',           'Nứt mối hàn',         'han',        20),
  ('han_lech',          'Lệch mối hàn',        'han',        21),
  ('han_chay_thung',    'Cháy thủng',          'han',        22),
  ('son_bui_ban',       'Bụi bẩn bám dính',    'son',        30),
  ('son_bong_troc',     'Bong tróc',           'son',        31),
  ('son_xuoc',          'Xước sơn',            'son',        32),
  ('son_sai_mau',       'Sai màu',             'son',        33),
  ('mai_lem',           'Mài lẹm',             'mai',        40),
  ('mai_chua_sach',     'Chưa sạch mối hàn',   'mai',        41),
  ('ht_thieu_phu_kien', 'Thiếu phụ kiện',      'hoan_thien', 50),
  ('ht_lap_lech',       'Lắp ráp lệch',        'hoan_thien', 51)
on conflict (code) do nothing;
