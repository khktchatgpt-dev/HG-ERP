-- 0207: Ô NHẬP RIÊNG THEO CÔNG ĐOẠN — khai bằng DỮ LIỆU, không thêm cột.
--
-- VẤN ĐỀ. Mỗi công đoạn cần ghi thứ khác nhau. Sổ Excel thật của thống kê
-- ("Tổng TĐ SX") đã làm đúng điều đó từ lâu: mỗi khối công đoạn có phần meta
-- riêng — PHÔI: Máy · Quy cách; HÀN: Loại máy hàn; NGUỘI: Thao tác; SƠN: Màu ·
-- Loại sơn; ĐAN: hàng trần / đang mây. Sổ trong hệ thống có `machine_note`
-- (chú thích 0084 ghi rõ "máy cắt / loại hàn / màu sơn") và `finish_state`
-- ('tran'/'dang_may'), nhưng màn ghi sổ dựng lại 18/09 KHÔNG có ô nào cho
-- chúng — hai cột chết. Và một ô `machine_note` cũng không đủ cho Sơn, vốn cần
-- hai thứ (màu + loại sơn).
--
-- VÌ SAO KHÔNG THÊM CỘT. Đối chiếu bốn hệ ERP (19/09): KHÔNG hệ nào thêm cột
-- vào sổ sản lượng theo công đoạn. Tất cả tách ra một bản ghi phụ gắn vào
-- công đoạn, và bản ghi đó KHAI BÁO được:
--   · SAP  — operation user fields + `field key` (nhãn đổi theo công đoạn,
--            khai ở Customizing OPEC); bản mới hơn là "data collection group"
--            của SAP Digital Manufacturing: mỗi ô có kiểu và min–max.
--   · Odoo — Quality Control Point gắn vào đúng một Operation, chọn kiểu
--            (Measure có dung sai / Pass–Fail / Instructions…).
--   · NetSuite — custom field trên Manufacturing Operation Task, đưa lên màn
--            bằng cấu hình.
--   · Dynamics — KHÔNG có, nên phải đẩy sang quality order. Đúng hơn: user-
--            defined fields của nó giới hạn 20 trường/BẢNG.
-- Chi tiết 20 cột/bảng của Dynamics và việc Odoo bắt mua Studio để thêm ô là
-- bằng chứng phản diện: giải bài này bằng CỘT thì hệ lớn cũng bí.
--
-- THIẾT KẾ. `production_stage_fields` khai (công đoạn → ô); giá trị nằm trong
-- `production_entries.stage_meta` kiểu jsonb. Thêm một ô cho một công đoạn về
-- sau = THÊM MỘT DÒNG DỮ LIỆU, không sửa mã, không migration. Postgres truy
-- vấn được jsonb nên vẫn trả lời được "tháng này sơn màu nào nhiều nhất, màu
-- nào hay lỗi nhất".
--
-- KHÔNG làm (đã cân nhắc và loại):
--   · Đơn vị đo riêng theo công đoạn (SAP Operation UoM) — chỉ SAP có, và ba
--     hệ kia không có vẫn chạy vì lời giải là TÁCH CẤP: chi tiết/cụm/bộ là ba
--     mã riêng. Dự án đã đi đường đó bằng "cụm mặc nhiên" — rẻ hơn nhiều.
--   · Standard value key + activity type + formula (SAP) — chỉ có lý khi tính
--     giá thành theo giờ máy/giờ công. Xưởng ghi tay, số giờ không đáng tin.
--   · Chứng từ chất lượng riêng có vòng đời (inspection lot / quality order) —
--     QC đang ghi giấy. Theo mô hình "inspection point" của SAP: ô đo nằm
--     NGAY trong phiếu ghi sổ, một lần nhập, không đẻ chứng từ thứ hai.
--
-- RLS: bảng mới ENABLED, no policies (chuẩn dự án — anon chặn, secret bypass).
-- Idempotent: create if not exists, add column if not exists, insert on
-- conflict do nothing.

-- ── 1) Bảng khai ô theo công đoạn ───────────────────────────────────────────
create table if not exists public.production_stage_fields (
  id          uuid primary key default gen_random_uuid(),
  -- code catalog production_stage. KHÔNG FK cứng — cùng triết lý danh mục của
  -- dự án: tham chiếu bằng code, đổi nhãn không làm sai sổ cũ.
  stage_code  text not null,
  -- khoá trong jsonb. snake_case, bất biến; đổi `label` không đụng sổ đã ghi.
  field_key   text not null,
  label       text not null,
  -- 'text' gõ tự do · 'number' số (dùng min/max làm dung sai) · 'select' chọn
  -- từ `options`.
  kind        text not null default 'text'
                check (kind in ('text', 'number', 'select')),
  -- Mảng chuỗi cho kind='select'. null với kiểu khác.
  options     jsonb,
  -- Bắt buộc thì CHẶN ghi sổ. Mặc định false: không hệ ERP nào bắt khai meta
  -- ngay lần đầu, và một ô bắt buộc gõ sai là một ô bị điền bừa.
  required    boolean not null default false,
  -- Dung sai cho kind='number' (chép Odoo "Measure"): ngoài dải thì cảnh báo
  -- ngay lúc gõ. null = không kiểm.
  min_value   numeric(14, 4),
  max_value   numeric(14, 4),
  sort_order  int     not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (stage_code, field_key)
);

drop trigger if exists trg_production_stage_fields_updated_at
  on public.production_stage_fields;
create trigger trg_production_stage_fields_updated_at
  before update on public.production_stage_fields
  for each row execute function public.set_updated_at();

create index if not exists production_stage_fields_stage_idx
  on public.production_stage_fields (stage_code, sort_order)
  where is_active;

alter table public.production_stage_fields enable row level security;

-- ── 2) Giá trị meta trên dòng sổ ────────────────────────────────────────────
alter table public.production_entries
  add column if not exists stage_meta jsonb;

comment on column public.production_entries.stage_meta is
  'Giá trị các ô riêng của công đoạn: {field_key: value}. Khai ở production_stage_fields.';

-- ── 3) Seed ĐÚNG THEO SỔ EXCEL đang dùng ────────────────────────────────────
-- Giữ sát sổ thật chứ không đoán cho đủ: cột nào thống kê đang ghi tay thì có
-- ô, cột nào không thì thôi. Thiếu thì thêm một dòng, không phải sửa mã.
insert into public.production_stage_fields
  (stage_code, field_key, label, kind, options, sort_order) values
  -- PHÔI: sổ ghi "Máy / Quy cách".
  ('phoi',     'may',       'Máy cắt',       'text',   null, 10),
  ('phoi',     'quy_cach',  'Quy cách',      'text',   null, 11),
  -- HÀN: sổ ghi "Loại máy hàn".
  ('han',      'may_han',   'Loại máy hàn',  'text',   null, 20),
  -- NGUỘI: sổ ghi "Thao tác".
  ('nguoi',    'thao_tac',  'Thao tác',      'text',   null, 30),
  -- SƠN: sổ ghi "Màu / Loại sơn" — hai ô, đúng lý do một `machine_note` không đủ.
  ('son',      'mau',       'Màu sơn',       'text',   null, 40),
  ('son',      'loai_son',  'Loại sơn',      'text',   null, 41),
  -- ĐAN: cột "TT hàng" của sổ, chính là `finish_state` cũ chưa bao giờ có ô.
  ('dan',      'tt_hang',   'Tình trạng hàng', 'select',
     '["Hàng trần", "Đang mây"]'::jsonb, 50)
on conflict (stage_code, field_key) do nothing;
