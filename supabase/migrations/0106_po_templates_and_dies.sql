-- MẪU ĐƠN ĐẶT HÀNG THEO LOẠI HÀNG + DANH MỤC KHUÔN NHÔM.
--
-- Bối cảnh: rà 8 file đơn đặt thật của phòng Cung ứng (E:\PO — 1 file/LSX, mỗi
-- sheet NCC là 1 đơn) cho thấy KHÔNG có một mẫu đơn duy nhất. Có 5 mẫu, khác
-- nhau cả bộ cột dòng hàng, công thức thành tiền, VAT mặc định lẫn khối chữ ký:
--
--   accessory  Vít/nút nhựa/pát/ty sắt/tem nhãn (TTL, MT, TN, TP, ATP, PQ…)
--              vật liệu · đm/sp · quy cách · SL ĐH · tồn · SL đặt(+3%) · đơn giá
--              tiền = SL đặt × đơn giá · VAT 8% · có dòng Chiết khấu
--   aluminium  Nhôm profile (Việt ECO, Tiến Đạt, Cát Tường, Taiwan, Việt Ý…)
--              mã khuôn · kg/m · dài cây(m) · số cây · số cây dư
--              tiền = (kg/m × dài × cây) × giá/kg · VAT 10% chưa gồm · cọc 30%
--   metal_kg   Inox/sắt cây·ống·tấm (Kim Vĩnh Phú, Hào Tư Hùng, Thông Đạt…)
--              vật liệu · kích thước · màu/bề mặt · SL · kg/đơn-vị
--              tiền = (SL × kg/đv) × giá/kg · VAT 10% đã gồm · tạm ứng 50%
--   carton     Bao bì (Bao bì 3/2) — cách mở AD/MR · pcs/ctn · D×R×C lọt lòng · m²
--              tiền = số thùng × giá/thùng, HOẶC tổng m² × giá/m² (chọn từng dòng)
--   simple     Mặc định: SL × đơn giá (giữ nguyên hành vi đơn hiện có)
--
-- ⭐ KHÔNG đổi công thức tiền: mọi mẫu vẫn quy về `poLineAmount` sẵn có —
-- price_basis='unit' (SL × giá) hoặc 'unit2' (qty2 × giá, unit2='kg'/'m²').
-- Các cột thêm ở đây là ĐẦU VÀO để dẫn xuất qty2 và để in đúng mẫu, không phải
-- một trục tính tiền thứ hai. Nhờ vậy đơn cũ (template='simple') không đổi số.
--
-- Công thức m² carton lấy đúng từ file (khác nhau theo cách mở, D/R/C = lọt lòng):
--   AD: ((D+2C)×(R+2C) + (D+2C+20)×(R+2C+20)) / 10^6
--   MR: ((D+2C)×(R+2C−10)) × 2 / 10^6
-- Không ép ở DB (chỉ lưu area_m2 đã chốt) vì NCC có thể chào m² khác barem.
--
-- technical_dies: 168 khuôn nhôm 2011→2026 từ sheet KHUÔN. Không có `weight_per_m`
-- của khuôn thì mẫu aluminium phải gõ tay từng dòng. `code` KHÔNG unique — file
-- gốc có khuôn được mở lại/sửa gân nên cùng mã tồn tại nhiều đời khác kg/m;
-- `is_current` đánh dấu đời đang dùng.
--
-- RLS: ENABLED, NO policies (anon bị chặn, secret key bypass) — như mọi bảng khác.
-- Idempotent: add column if not exists / create table if not exists.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

-- 1. Mẫu đơn + điều khoản tách dòng trên header PO ---------------------------------

alter table public.supply_purchase_orders
  add column if not exists template text not null default 'simple'
    check (template in ('accessory', 'aluminium', 'metal_kg', 'carton', 'simple')),
  -- Chiết khấu: chỉ mẫu accessory in dòng này, nhưng để chung cho đơn giản.
  add column if not exists discount_amount numeric(14, 2),
  add column if not exists contract_no text,             -- "Theo HD số:"
  -- 5 điều khoản in thành 5 dòng riêng trên phiếu (cột `terms` cũ giữ nguyên cho
  -- đơn đã tạo; form mới ghi vào 5 cột này).
  add column if not exists terms_quality text,           -- Tiêu chuẩn chất lượng
  add column if not exists terms_delivery_place text,    -- Địa điểm giao hàng
  add column if not exists terms_payment text,           -- Hình thức thanh toán
  add column if not exists terms_invoice text,           -- Chứng từ thanh toán
  add column if not exists terms_lead_time text,         -- Thời gian giao hàng
  -- Khối chữ ký giữa: mẫu accessory ký "Người Lập", nhôm/inox ký "TRƯỞNG PHÒNG
  -- KẾ HOẠCH". Lưu nhãn thay vì suy từ template để sửa được không cần deploy.
  add column if not exists signer_role text;

create index if not exists supply_pos_template_idx
  on public.supply_purchase_orders (template);

-- 2. Cột dòng hàng theo mẫu ---------------------------------------------------------

alter table public.supply_purchase_order_lines
  -- Dùng chung nhiều mẫu
  add column if not exists material_grade text,          -- "Nhựa đen", "Sắt xi trắng"
  add column if not exists product_code text,            -- Mã SP (tem nhãn, bao bì)
  add column if not exists dm_per_sp numeric(14, 4),     -- Định mức / sản phẩm
  add column if not exists qty_demand numeric(14, 4),    -- SL đơn hàng (nhu cầu gộp)
  add column if not exists qty_on_hand numeric(14, 4),   -- Tồn kho lúc lập đơn
  -- Hao hụt: SL đặt = (nhu cầu − tồn) × (1 + waste_pct/100), LÀM TRÒN LÊN rồi
  -- cho ghi đè tự do — file thật có dòng sửa tay lệch hẳn công thức (LĐ chẻ lỗ
  -- cần 1400 đặt 1000; Vít 4x25 cần 700 đặt 540, do quy đổi con→bộ).
  add column if not exists waste_pct numeric(6, 2),
  -- Mẫu aluminium
  add column if not exists die_code text,                -- TD-B768, TD-HG17…
  add column if not exists weight_per_m numeric(12, 4),  -- kg/m (từ technical_dies)
  add column if not exists bar_length_m numeric(10, 3),  -- chiều dài cây đặt (m)
  add column if not exists bar_surplus numeric(12, 2),   -- số cây dư
  -- Mẫu metal_kg
  add column if not exists dimension_text text,          -- "Inox phi 15.9x1.5li"
  add column if not exists finish text,                  -- "inox bóng", "2B"
  add column if not exists weight_per_unit numeric(12, 4), -- kg/cây hoặc kg/tấm
  -- Mẫu carton
  add column if not exists open_style text,              -- AD / MR
  add column if not exists pcs_per_ctn numeric(10, 2),
  add column if not exists inner_l_mm numeric(10, 2),
  add column if not exists inner_w_mm numeric(10, 2),
  add column if not exists inner_h_mm numeric(10, 2),
  add column if not exists area_m2 numeric(12, 4),       -- m² / thùng
  add column if not exists price_per_m2 numeric(14, 2),
  -- 'ctn' = tiền theo số thùng × giá/thùng; 'm2' = tổng m² × giá/m². User chốt
  -- chọn được TỪNG DÒNG vì NCC chào lẫn lộn hai kiểu trong cùng một đơn.
  add column if not exists carton_basis text
    check (carton_basis is null or carton_basis in ('ctn', 'm2'));

-- 3. Danh mục khuôn nhôm -------------------------------------------------------------

create table if not exists public.technical_dies (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,                         -- TD-B768, AM-HG03, TW-HG02
  name            text,                                  -- chi tiết khuôn tạo ra
  profile_spec    text,                                  -- "Hộp 10x40x1.0Li", "La 4x57"
  weight_per_m    numeric(12, 4),                        -- ⭐ kg/m — mẫu đơn nhôm cần
  unit            text,                                  -- Bộ
  die_price       numeric(14, 2),                        -- tiền mở khuôn
  supplier_name   text,                                  -- NCC giữ khuôn (text: file
                                                         -- ghi "Xuân Kỳ → Tiến Đạt")
  supplier_id     uuid references public.supply_suppliers(id) on delete set null,
  -- 'active' đang dùng · 'broken' khuôn hư · 'retired' đã bỏ. File gốc ghi trong
  -- ghi chú ("Khuôn Hư 27/03/2025", "Bỏ") nên import suy ra rồi cho sửa tay.
  status          text not null default 'active'
                    check (status in ('active', 'broken', 'retired')),
  -- Cùng mã có nhiều đời (mở lại / bỏ gân / tăng dày) khác kg/m → đánh dấu đời
  -- đang dùng thay vì unique(code).
  is_current      boolean not null default true,
  effective_date  date,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists technical_dies_code_idx on public.technical_dies (lower(code));
create index if not exists technical_dies_current_idx
  on public.technical_dies (is_current) where is_current;

drop trigger if exists trg_technical_dies_updated_at on public.technical_dies;
create trigger trg_technical_dies_updated_at
  before update on public.technical_dies
  for each row execute function public.set_updated_at();

alter table public.technical_dies enable row level security;

-- 4. Mẫu đơn mặc định theo vật tư ------------------------------------------------------
-- Nhu cầu LSX nổ ra là biết ngay dòng nào về mẫu nào (nhôm → aluminium, vít/nút →
-- accessory) mà không phải hỏi. NULL = chưa khai → form suy theo `group_name`, hết
-- thì hỏi người dùng.
--
-- ⚠️ Gắn thẳng lên `warehouse_materials`, KHÔNG qua `item_categories`: cây nhóm có
-- cấu trúc của 0042/0043 chưa từng được apply lên DB thật (kiểm tra 31/07/2026 —
-- bảng không tồn tại, `warehouse_materials` cũng không có `category_id`). Grouping
-- đang chạy thật vẫn là cột text `group_name`.

alter table public.warehouse_materials
  add column if not exists po_template text
    check (po_template is null
           or po_template in ('accessory', 'aluminium', 'metal_kg', 'carton', 'simple'));

-- Suy mẫu từ `group_name` cho dữ liệu đang có — chỉ điền chỗ còn trống, người dùng
-- sửa tay sau này không bị migration ghi đè (điều kiện `is null`).
update public.warehouse_materials set po_template = 'aluminium'
where po_template is null and (group_name ilike '%nhôm%' or group_name ilike '%nhom%');

update public.warehouse_materials set po_template = 'metal_kg'
where po_template is null
  and (group_name ilike '%inox%' or group_name ilike '%sắt%' or group_name ilike '%thép%'
       or group_name ilike '%tôn%' or group_name ilike '%ống%');

update public.warehouse_materials set po_template = 'carton'
where po_template is null
  and (group_name ilike '%bao bì%' or group_name ilike '%carton%' or group_name ilike '%thùng%');

update public.warehouse_materials set po_template = 'accessory'
where po_template is null
  and (group_name ilike '%phụ kiện%' or group_name ilike '%ốc%' or group_name ilike '%vít%'
       or group_name ilike '%nhựa%' or group_name ilike '%tem%' or group_name ilike '%nhãn%');
