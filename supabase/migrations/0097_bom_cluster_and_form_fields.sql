-- ĐỊNH MỨC v2 — CẤP CỤM + các trường của biểu mẫu BOM mới.
--
-- Nguồn thiết kế: docs/dinh-muc-redesign-plan.md, dựng từ 2 file mẫu user đưa
-- 27/07/2026 (`BOM_Shelter Home_ ghế 3 Đan dây.xlsx`, `… ghế 3 30x100 uống
-- cong.xlsx`) — biểu mẫu "BẢNG ĐỊNH MỨC NGUYÊN - PHỤ KIỆN", hiệu lực 28-02-2026.
--
-- Biểu mẫu mới có cột `Parts/ Bộ phận` = CỤM. Trước đây cụm chỉ nằm ngầm trong
-- prefix tên chi tiết, và `production/components.service.ts` phải MƯỢN
-- `set_item_label` làm cụm. Migration này cho cụm một chỗ đứng thật.
--
-- DỮ LIỆU: bảng technical_product_parts đã được XOÁ SẠCH trước khi chạy file này
-- (1.316 dòng / 49 SP, user chốt D1 ngày 27/07/2026). Bản lưu:
--   supabase/backups/2026-07-27_technical_product_parts.{json,csv}
-- Vì vậy các lệnh `drop column` dưới đây không làm mất dữ liệu nào.
--
-- BỎ TIỀN KHỎI ĐỊNH MỨC (quyết định D4): định mức trả lời "cần bao nhiêu", không
-- trả lời "hết bao nhiêu tiền". Giá mua thật thuộc bảng giá NCC bên Cung ứng.
-- Đã rà: `unit_price`/`amount` của bảng này không có chỗ đọc nào ngoài module
-- Kỹ thuật — báo giá / đơn hàng / PO / hoá đơn dùng bảng riêng của chúng.
--
-- BỎ `set_item_label` (quyết định D3): biểu mẫu mới có ĐÚNG MỘT ô `TÊN SP` cho
-- cả sheet ⇒ 1 file BOM = 1 sản phẩm. Bộ ("Shelter Home ghế 3") ghép bằng
-- technical_product_set_items, mỗi món giữ định mức riêng — không nhân đôi dòng.
--
-- BỎ `waste_pct`: biểu mẫu ghi "Phi hao chi tiết uốn" bằng MILIMET cộng vào
-- chiều dài cắt, không phải phần trăm. Thay bằng `bend_waste_mm`.
--
-- RLS: bảng mới `technical_product_clusters` bật RLS KHÔNG policy — anon/
-- publishable key bị chặn hoàn toàn, server dùng secret key bypass. Đúng tư thế
-- chung của dự án. Không tạo view nào.
--
-- Idempotent: create ... if not exists, add/drop column if (not) exists,
-- drop trigger if exists rồi create.

-- ── 1. CỤM ────────────────────────────────────────────────────────────────────
-- Cụm là BẢNG RIÊNG chứ không phải cột text hay dòng tự-FK trong bảng định mức:
--   · cột text  → gõ lệch 1 ký tự là tách thành 2 cụm (đúng chỗ vỡ của Excel),
--                 và không có chỗ treo "SL cụm/SP" + lộ trình công đoạn.
--   · dòng tự-FK (kind='assembly' + parent_part_id) → cụm thành một dòng định
--                 mức có `qty` ⇒ rủi ro cộng hai lần vào tổng khối lượng.
-- Bảng riêng: tên lưu một chỗ (đổi tên không drift), cụm có số riêng khi cần,
-- và dòng định mức vẫn thuần "thứ cắt/mua được" nên mọi phép tổng an toàn.
--
-- CHỈ 2 CẤP ĐẾM, KHÔNG CỤM-LỒNG-CỤM (user chốt 07/2026): bảng này cố ý KHÔNG có
-- parent_cluster_id. Cây: SẢN PHẨM → KHỐI → CỤM → CHI TIẾT.
create table if not exists public.technical_product_clusters (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.technical_products(id) on delete cascade,
  -- Đúng chữ trong cột `Parts/ Bộ phận`: "Cụm khung", "Cụm mê".
  name            text not null,
  -- SL cụm / 1 SP — sổ `Tổng TĐ SX` của xưởng đếm theo cụm từ công đoạn hàn trở
  -- đi. Biểu mẫu BOM không có ô này nên null = chưa khai, hợp lệ.
  qty_per_product numeric(14,4),
  -- Lộ trình công đoạn của cụm (code trong production_stages). Chi tiết rời dừng
  -- ở phôi; cụm mặc định hàn → sơn.
  first_stage     text,
  final_stage     text,
  note            text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Một SP không thể có 2 cụm trùng tên — cũng là chỗ dựa để "gõ tên cụm mới thì
  -- tạo, gõ tên đã có thì gán vào cụm đó".
  unique (product_id, name)
);

create index if not exists technical_product_clusters_product_idx
  on public.technical_product_clusters (product_id, sort_order);

drop trigger if exists set_updated_at on public.technical_product_clusters;
create trigger set_updated_at
  before update on public.technical_product_clusters
  for each row execute function public.set_updated_at();

alter table public.technical_product_clusters enable row level security;

-- ── 2. Dòng định mức: cột mới ─────────────────────────────────────────────────
alter table public.technical_product_parts
  -- Cụm của dòng. null = dòng RỜI, trực thuộc SP (file `Đan dây` để trống toàn
  -- bộ; file `30x100 uống cong` có 2 dòng Pát không thuộc cụm nào). Xoá cụm thì
  -- dòng về Rời chứ không mất.
  add column if not exists cluster_id         uuid references public.technical_product_clusters(id) on delete set null,
  -- "Phi hao chi tiết uốn" (mm) — cộng vào chiều dài khi tính tổng dài, nhưng
  -- KHÔNG cộng khi tính diện tích sơn (đúng như công thức trong file).
  add column if not exists bend_waste_mm      numeric(10,2),
  -- "Mộng" của khối gỗ/nệm tham gia công thức: (Dài + Mộng). Cột `tenon` text cũ
  -- giữ nguyên cho phần mô tả không phải số.
  add column if not exists tenon_mm           numeric(10,2),
  -- Profile không tính được bằng hình học, tra bảng kg/m. Ví dụ ngay trong file:
  -- `TD-HG04 / 0.260` (thanh 12 × 24).
  add column if not exists kg_per_m           numeric(12,4),
  -- Diện tích sơn theo ĐÚNG công thức file — chu vi hình hộp (Dày+Rộng)×2 áp cho
  -- MỌI dạng, kể cả ống tròn (Ø16 ra 64 mm thay vì 50,3 mm, dư 27%). Cột chính
  -- `paint_area_m2` dùng chu vi thật; cột này giữ để đối chiếu với bảng kê giấy
  -- xưởng đang ký (quyết định D2).
  add column if not exists paint_area_box_m2  numeric(14,6),
  -- Màu sơn / màu vật tư ("7 màu", "xi trắng"). Là QUY CÁCH, không phải tiền.
  add column if not exists color              text,
  -- "Xác nhận Phôi" — cột có sẵn trong biểu mẫu, quyền của xưởng phôi. Tick được
  -- ở MỌI trạng thái hồ sơ (kể cả `done`) vì nó không sửa số liệu.
  add column if not exists blank_confirmed_at timestamptz,
  add column if not exists blank_confirmed_by uuid references public.users(id) on delete set null,
  add column if not exists updated_by         uuid references public.users(id) on delete set null;

create index if not exists technical_product_parts_cluster_idx
  on public.technical_product_parts (cluster_id);

-- ── 3. Dòng định mức: bỏ cột ──────────────────────────────────────────────────
-- Xem phần đầu file cho lý do từng cột. Bảng đang rỗng nên không mất dữ liệu.
alter table public.technical_product_parts
  drop column if exists unit_price,
  drop column if exists amount,
  drop column if exists waste_pct,
  drop column if exists set_item_label;

-- ── 4. Sản phẩm: các ô đầu biểu mẫu chưa có chỗ lưu ───────────────────────────
alter table public.technical_products
  -- Ô "Nhiên Liệu" của biểu mẫu ('AL' | 'IR' | 'IN') — nguồn tra tỉ trọng
  -- (Nhôm 2.7 · Sắt 7.85 · Inox 7.93). Chỉ là MẶC ĐỊNH: `parts.material_kind`
  -- per-dòng vẫn thắng, cần cho SP khung Sắt + đế Nhôm mà biểu mẫu Excel với một
  -- ô Nhiên Liệu duy nhất không diễn tả được.
  add column if not exists base_material            text,
  -- Ô "KL.Thực tế / BK" — khối lượng cân thật, để so với khối lượng tính ra.
  -- Trong file đang là chuỗi "10kg" nên không so được; ở đây là số.
  add column if not exists actual_weight_kg         numeric(12,3),
  -- Định mức sơn m²/kg. File hard-code 5 trong công thức `=L36/5`.
  add column if not exists paint_coverage_m2_per_kg numeric(8,2) default 5,
  -- Khối kiểm soát tài liệu ISO ở đầu biểu mẫu (HG-QT-07/M02).
  add column if not exists bom_rev                  integer,
  add column if not exists bom_effective_date       date,
  add column if not exists bom_prepared_by          text,
  add column if not exists bom_approved_by          text;
