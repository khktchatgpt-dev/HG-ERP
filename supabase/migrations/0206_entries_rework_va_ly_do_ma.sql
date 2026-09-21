-- 0206: SỔ SẢN LƯỢNG — thêm ô SỬA LẠI và lý do lỗi theo DANH MỤC.
-- Thiết kế: docs/san-xuat-ghi-san-luong-thiet-ke.md
--
-- 1) Ô THỨ BA. Sổ đang chỉ có `qty` (đạt) và `defect_qty` (phế). Hàng hỏng
--    nhưng CỨU ĐƯỢC — mối hàn lệch mài lại, sơn lỗi chà lại, chuyện hằng ngày
--    của nội thất kim loại — không có chỗ ghi. Thống kê phải chọn: khai là phế
--    (thổi phồng tỷ lệ phế, và món đó biến mất khỏi "còn phải làm" dù nó vẫn
--    nằm đó), hoặc lờ đi rồi ghi lại lúc sửa xong (không ai biết đã tốn thêm
--    một lượt công).
--
--    Chép mô hình SAP (hệ duy nhất trong bốn hệ lớn tách đủ ba loại):
--    ĐẠT chạy tiếp công đoạn sau, PHẾ và SỬA LẠI thì không. Khác nhau ở chỗ
--    phế ĂN MẤT đầu vào, còn sửa lại thì KHÔNG trừ gì cả — món đó vẫn còn,
--    sửa xong ghi lần thứ hai vào ô đạt. Trừ nó ngay là làm "còn phải làm"
--    nhỏ hơn thực tế, rồi lượt ghi thứ hai sẽ vượt số lệnh.
--
--    KHÔNG làm lệnh sản xuất phụ cho hàng sửa (SAP có, rất nặng) — đếm đúng
--    là đủ cho một xưởng.
--
-- 2) LÝ DO THEO DANH MỤC — ĐÂY LÀ ĐẢO MỘT QUYẾT ĐỊNH CŨ, ĐỌC KỸ TRƯỚC KHI ÁP.
--
--    `production_defect_codes` do 0067 tạo (17 mã kèm `stage_code` để lọc theo
--    công đoạn), và 0084 `production_v2` ĐÃ CỐ Ý DROP NÓ. Nguyên văn 0084:
--    "Phế = số + lý do text tự do (bỏ danh mục mã lỗi — user chốt đơn giản
--    hoá)" và "Bỏ hẳn: production_incidents + production_defect_codes (sự cố
--    báo ngoài hệ — user chốt)". Tức bảng vắng mặt hôm nay KHÔNG phải lỗi
--    migration; đó là điều chủ dự án muốn hồi 07/2026.
--
--    Dựng lại thì phải trả lời được: vì sao lần này khác? Hai điểm:
--      a) Mối lo cũ là danh sách dài và rườm. Nay ô chọn LỌC THEO CÔNG ĐOẠN
--         đang ghi — tổ sơn thấy ~7 mục, không phải 17.
--      b) Danh mục là TUỲ CHỌN, không ép. Ô lý do vẫn là một ô gõ-hoặc-chọn:
--         gõ trúng nhãn thì lưu mã, gõ tự do thì lưu chữ như hiện nay. Không
--         ai bị chặn vì không chọn được mã.
--
--    Nếu chủ dự án vẫn muốn giữ nguyên chữ tự do thì BỎ mục 2 và 3 của
--    migration này; mục 1 (ô sửa lại) đứng độc lập, không phụ thuộc danh mục.
--
--    `defect_code` tham chiếu BẰNG CODE, không FK cứng (triết lý danh mục của
--    dự án: đổi nhãn không làm sai sổ cũ). `defect_reason` giữ nguyên vai trò
--    hiện có, thêm nhiệm vụ ghi rõ khi chọn mã 'khac'.
--
-- 3) DANH MỤC rà theo lộ trình mới: bỏ nhóm 'mai' (công đoạn mài đã gỡ
--    18/09), thêm mã cho sáu công đoạn chưa có. Bộ thêm dưới đây là NHÁP —
--    xưởng phải đọc lại, đó là việc của người biết nghề. Không gấp: bốn mã
--    dùng chung (stage_code null) vốn đã phủ mọi công đoạn nên màn không bao
--    giờ trống.
--
-- RLS: không đổi posture (cả hai bảng đã enable row level security, no
-- policies, từ 0084/0067).
-- Idempotent: add column if not exists, drop constraint trước khi add, insert
-- on conflict do nothing, update theo điều kiện.

-- ── 1) Ô SỬA LẠI ────────────────────────────────────────────────────────────
alter table public.production_entries
  add column if not exists rework_qty numeric(14, 2) not null default 0;

alter table public.production_entries
  drop constraint if exists production_entries_rework_qty_check;
alter table public.production_entries
  add constraint production_entries_rework_qty_check check (rework_qty >= 0);

-- Dòng CHỈ CÓ sửa lại phải hợp lệ. 0173 nới cho dòng chỉ-có-phế nhưng ràng
-- buộc khi đó chỉ biết hai ô; để nguyên là chặn đúng nghiệp vụ vừa mở.
alter table public.production_entries
  drop constraint if exists production_entries_qty_or_defect_check;
alter table public.production_entries
  add constraint production_entries_qty_or_defect_check
  check (qty > 0 or defect_qty > 0 or rework_qty > 0);

-- ── 2) Lý do theo mã ────────────────────────────────────────────────────────
alter table public.production_entries
  add column if not exists defect_code text;

comment on column public.production_entries.defect_code is
  'Mã lý do lỗi — production_defect_codes.code. Áp cho cả phế lẫn sửa lại.';
comment on column public.production_entries.defect_reason is
  'Ghi chú thêm về lỗi. Bắt buộc khi defect_code = ''khac''.';

-- ── 3) Danh mục lý do ───────────────────────────────────────────────────────
-- DỰNG LẠI BẢNG Ở ĐÂY chứ không sửa 0067: 0067 đã chạy xong từ 20/07/2026 và
-- tạo bảng bình thường; chính 0084 drop nó bốn ngày sau, có chủ đích. Migration
-- đã chạy thì không sửa — muốn bảng trở lại thì dựng ở migration mới, đúng
-- luật đánh số của dự án.
create table if not exists public.production_defect_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  label      text not null,
  -- code catalog production_stage; null = áp dụng MỌI công đoạn.
  stage_code text,
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

-- Seed gốc của 0067, trừ nhóm 'mai' (công đoạn mài đã gỡ khỏi lộ trình 18/09).
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
  ('ht_thieu_phu_kien', 'Thiếu phụ kiện',      'hoan_thien', 50),
  ('ht_lap_lech',       'Lắp ráp lệch',        'hoan_thien', 51)
on conflict (code) do nothing;

-- Nếu 0067 từng chạy được ở môi trường nào đó thì tắt nhóm mài cho khớp.
update public.production_defect_codes
set is_active = false
where stage_code = 'mai' and is_active;

-- NHÁP — xưởng rà lại. Giữ ít và chắc chắn đúng nghề hơn là đoán cho đủ.
insert into public.production_defect_codes (code, label, stage_code, sort_order) values
  ('nguoi_chua_sach',    'Chưa sạch mối hàn',        'nguoi',    15),
  ('nguoi_lem',          'Mài lẹm / mất góc',        'nguoi',    16),
  ('may_lech_duong',     'Lệch đường may',           'may',      25),
  ('may_nhan_vai',       'Nhăn vải',                 'may',      26),
  ('dan_bung_moi',       'Bung mối đan',             'dan',      28),
  ('dan_sai_hoa_van',    'Sai hoa văn',              'dan',      29),
  ('lap_khong_khop',     'Lỗ bắt vít không khớp',    'lap_rap',  44),
  ('lap_thieu_chi_tiet', 'Thiếu chi tiết',           'lap_rap',  45),
  ('bb_sai_tem',         'Sai / thiếu tem nhãn',     'bao_bi',   60),
  ('bb_rach_thung',      'Rách thùng',               'bao_bi',   61),
  ('dg_sai_quy_cach',    'Sai quy cách đóng gói',    'dong_goi', 70),
  ('dg_thieu_bo_phan',   'Thiếu bộ phận trong kiện', 'dong_goi', 71)
on conflict (code) do nothing;
