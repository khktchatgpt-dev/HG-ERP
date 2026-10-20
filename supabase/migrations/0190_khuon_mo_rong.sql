-- 0190: KHUÔN NHÔM — mở rộng danh mục + sổ sự kiện + nối sang vật tư.
--
-- Vì sao cần: `technical_dies` (0106) đang có 142 dòng và đã được hai màn đọc
-- (ô chọn khuôn khi soạn đơn mua nhôm, lưới định mức SP). File hợp nhất mới của
-- phòng Kỹ thuật — "QUAN LY KHUON NHOM - HOP NHAT_5.xlsx", gộp từ 4 file cũ —
-- có 189 mã với những trường bảng hiện KHÔNG chứa nổi: nhóm chi tiết, nơi giữ
-- khuôn (tách khỏi tình trạng), ảnh mặt cắt, các cách viết cũ của mã, và các
-- thông số để xưởng đổi "dài cắt" ra "mấy cây nhôm".
-- Kế hoạch đầy đủ + số đo: docs/quan-ly-khuon-ke-hoach.md
--
-- ⭐ MỞ RỘNG bảng đang chạy, KHÔNG dựng bảng khuôn thứ hai. Hai nguồn kg/m cho
-- cùng một mã khuôn chính là thứ file Excel kia đang phải đi dọn hậu quả (sheet
-- ĐỐI CHIẾU LỆCH, 145 dòng, sinh ra vì 4 file cùng ghi một mã).
--
-- ⭐ NƠI GIỮ KHUÔN LÀ TRỤC RIÊNG, không phải một giá trị của `status`. File cũ
-- trộn hai trục vào một cột ("Đã chuyển nơi khác" = 16 mã) nên hỏi "có bao nhiêu
-- khuôn đang dùng" là ra số sai — khuôn chuyển từ Xuân Kỳ sang Tiến Đạt vẫn là
-- khuôn đang dùng.
--
-- ⭐ ĐỜI KHUÔN THÀNH SỰ KIỆN. Hôm nay cả đời một cái khuôn nằm trong ô ghi chú:
--   "Hư · TD-DTBD05 (Mở Lại) · Báo khuôn hư 23/2/2022 ĐỨC TOÀN MỞ LẠI 12/5/2022"
-- — 3 sự kiện, 2 mốc ngày, 1 mã thay thế trong một chuỗi, không đếm được.
--
-- KHÔNG đụng cột cũ, KHÔNG đổi tên cột nào: `dies.repo.ts` và `DiePicker` đang
-- đọc `code/name/profile_spec/weight_per_m/supplier_name/status/is_current/note`.
-- `status` chỉ NỞ thêm giá trị, ba giá trị cũ giữ nguyên tên.
--
-- RLS: enable, no policies (anon chặn, secret-key server bypass) — như mọi bảng.
-- Idempotent: add column if not exists / create table if not exists.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

-- ── 1. Hồ sơ khuôn: phân loại, nơi giữ, ảnh, độ tin cậy ───────────────────

alter table public.technical_dies
  -- Nhóm chi tiết (Chân / Diềm bàn / Tựa lưng…) — 12 giá trị, lọc chính của màn
  -- danh sách. Text tự do + gợi ý, KHÔNG FK sang danh mục phòng khác.
  add column if not exists part_group text,
  add column if not exists profile_shape text,          -- Hộp vuông, Oval, La…
  add column if not exists alloy text,                  -- Nhôm 6063 / Nhôm 96%

  -- Nơi giữ khuôn — TRỤC RIÊNG với `status`. `supplier_name` (0106) giữ nguyên
  -- làm "NCC ghi trên file gốc" để tra ngược; `holder_name` là nơi giữ hiện tại.
  add column if not exists holder_name text,
  -- Trỏ được thì trỏ. KHÔNG bắt buộc: 11 nơi giữ viết ngắn ("Tiến Đạt"), 164 NCC
  -- viết tên pháp nhân ("Công Ty TNHH Nhôm Tiến Đạt"). Ép FK là chặn người dùng
  -- ghi một nơi giữ mà phòng Cung ứng chưa kịp khai.
  add column if not exists holder_supplier_id uuid
    references public.supply_suppliers(id) on delete set null,

  -- Mọi cách viết cũ của mã: "TD916-1", "TD916-3", "TD-A591 cũ". Người xưởng nhớ
  -- cách viết cũ, không nhớ mã chuẩn — đây là chìa khoá của ô tìm VÀ của việc
  -- khớp `technical_product_parts.profile_code`.
  add column if not exists legacy_codes text[] not null default '{}',

  -- Ảnh mặt cắt. 170/189 mã trong file có ảnh nhúng thật — với tổ định hình cầm
  -- cây nhôm không có mã in, ảnh mặt cắt là cách nhận dạng duy nhất.
  add column if not exists image_file_id uuid
    references public.files(id) on delete set null,

  -- 'confirmed' = số liệu đã được người phụ trách chốt.
  -- 'needs_review' = các file cũ ghi khác nhau (20 mã), hoặc mã chỉ có một nguồn
  -- (62 mã) → phải rà. Bày ra màn hình, KHÔNG giấu ô trống cho đẹp.
  add column if not exists data_confidence text not null default 'confirmed'
    check (data_confidence in ('confirmed', 'needs_review')),
  add column if not exists review_note text,

  -- Mã cụm khuôn nghi trùng (22 cụm / 53 mã: cùng một loại profile đang nằm ở
  -- 2–3 NCC). Là NHÃN để lọc, không phải bảng riêng — cụm không có đời sống.
  add column if not exists duplicate_group text,

  add column if not exists source_note text;             -- nguồn dữ liệu khi nạp

-- Trạng thái: 3 → 7 giá trị. "Đã chuyển nơi khác" KHÔNG có ở đây (là `holder_name`
-- đổi + một sự kiện). "Đã sửa / bỏ gân" cũng không (khuôn sửa xong vẫn đang dùng
-- — nó là sự kiện, không phải trạng thái).
--
-- 'unknown' là giá trị THẬT, không phải giá trị rác: 74/189 mã (39%) trong file
-- hợp nhất ghi "Chưa xác định" — mang theo ~387 triệu tiền mở khuôn mà không ai
-- biết còn sống hay đã chết. Nhét chúng vào 'active' cho gọn là nói dối trên
-- chính con số mà tính năng này sinh ra để sửa.
alter table public.technical_dies drop constraint if exists technical_dies_status_check;
alter table public.technical_dies
  add constraint technical_dies_status_check check (
    status in ('pending', 'active', 'rarely_used', 'broken',
               'replaced', 'retired', 'unknown')
  );

-- Mồi `holder_name` từ dữ liệu đang có, chỉ chỗ còn trống — sửa tay sau này
-- không bị migration ghi đè.
update public.technical_dies
   set holder_name = supplier_name
 where holder_name is null and supplier_name is not null;

create index if not exists technical_dies_holder_idx on public.technical_dies (holder_name);
create index if not exists technical_dies_group_idx on public.technical_dies (part_group);
create index if not exists technical_dies_review_idx
  on public.technical_dies (data_confidence) where data_confidence = 'needs_review';
create index if not exists technical_dies_dup_idx
  on public.technical_dies (duplicate_group) where duplicate_group is not null;
-- Tìm theo cách viết cũ: `legacy_codes @> array['TD916-3']`.
create index if not exists technical_dies_legacy_idx
  on public.technical_dies using gin (legacy_codes);

-- ── 2. Thông số phục vụ SẢN XUẤT ──────────────────────────────────────────
-- Đo 13/09/2026 trên 462 dòng định mức có ghi mã khuôn: dài cắt có 93%, nhưng
-- kg/m 1%, chiều dài cây 0%, số phôi/cây 0%. Và 994 chi tiết của 17 lệnh SX
-- đang chạy: `material_id` 0%, `pcs_per_bar` 0%.
--
-- Tức là xưởng biết cắt dài bao nhiêu mà KHÔNG chỗ nào đổi ra "mấy cây nhôm" —
-- và ba số còn thiếu (kg/m · dài cây · tiết diện) đều là thuộc tính của KHUÔN.
--
--   số phôi/cây = ⌊(dài cây − đầu chừa) ÷ (dài cắt + mạch cưa)⌋
--   số cây      = ⌈SL chi tiết ÷ số phôi/cây⌉
--   kg          = kg/m × dài cây × số cây
--
-- ⚠️ KHÔNG tự tính `weight_per_m` từ tiết diện. kg/m là số CÂN THẬT của từng NCC
-- (5 bảng TRA CỨU trong file là số cân đó); tiết diện chỉ để nhận dạng. Suy từ
-- công thức là đẻ nguồn thứ hai cho cùng một số.

alter table public.technical_dies
  -- Tiết diện — để NHẬN DẠNG cây nhôm và soát hàng NCC giao, không để tính kg/m.
  add column if not exists section_a_mm numeric(10, 2),
  add column if not exists section_b_mm numeric(10, 2),
  add column if not exists wall_thickness_mm numeric(10, 2),
  add column if not exists outer_diameter_mm numeric(10, 2),   -- ống tròn
  -- Số gân. Toàn bộ nghiệp vụ "bỏ gân" (28 mã đã sửa, tiết kiệm hàng chục triệu)
  -- xoay quanh con số này — nằm trong ghi chú thì không lọc được.
  add column if not exists rib_count smallint,

  -- Cây nhôm. 6 m là chuẩn ghi trong catalogue HHT; để sửa được vì có NCC giao
  -- 5,8 / 6,1 m.
  add column if not exists bar_length_m numeric(6, 3),
  add column if not exists pcs_per_bundle smallint,            -- số cây/bó (kho nhận theo bó)
  -- Dung sai trọng lượng. Bảng Phong Gia Phát bày sẵn 3 cột −0.05 / TIÊU CHUẨN /
  -- +0.05 = ±5%: đặt 1 tấn nhôm nhận về lệch tới 5% số cây. Kho nhận theo cây,
  -- đơn mua tính theo kg — chênh đó hôm nay không ai ghi ở đâu.
  add column if not exists weight_tolerance_pct numeric(5, 2),

  -- Mạch cưa + đầu chừa mỗi cây. Để NULL = dùng mặc định chung của công ty; chỉ
  -- ghi khi khuôn này khác. Không bắt Kỹ thuật gõ 230 lần cùng một số.
  add column if not exists saw_kerf_mm numeric(6, 2),
  add column if not exists end_trim_mm numeric(6, 2),

  -- Nhận dạng tại xưởng: bề mặt (anod / sơn / mộc) và dấu in trên cây.
  add column if not exists surface_finish text,
  add column if not exists marking text;

-- ── 3. Sổ sự kiện đời khuôn ───────────────────────────────────────────────
-- Mỗi lần đổi trạng thái / đổi nơi giữ / sửa gân ghi MỘT dòng. Sheet "LỊCH SỬ
-- SỬA KHUÔN" (43 dòng / 30 mã) là dữ liệu mồi cho bảng này.
--
-- Bảng này cũng là chỗ về hưu của mẹo `is_current`: cùng một mã đang bị tách
-- thành nhiều dòng khác kg/m (16 dòng "đời cũ" trong DB). Một mã = một dòng,
-- kg/m đổi thì ghi sự kiện. Nhưng `is_current` GIỮ NGUYÊN ở bước này —
-- `diesRepo.search()` đang lọc theo nó, bỏ sớm là ô chọn khuôn hiện cả khuôn hư.

create table if not exists public.technical_die_events (
  id             uuid primary key default gen_random_uuid(),
  die_id         uuid not null references public.technical_dies(id) on delete cascade,
  -- opened     mở khuôn            · modified   sửa / bỏ gân
  -- transferred chuyển nơi giữ     · broken     NCC báo hư
  -- replaced   thay bằng mã khác   · retired    bỏ hẳn
  -- reopened   mở lại sau khi hư   · note       ghi chú có mốc thời gian
  event_type     text not null check (event_type in
                   ('opened', 'modified', 'transferred', 'broken',
                    'replaced', 'retired', 'reopened', 'note')),
  -- Ngày sự kiện ≠ ngày ghi sổ: 30/43 dòng lịch sử cũ không có ngày, và nhập bù
  -- chuyện năm 2022 là bình thường. NULL = không rõ ngày, đừng bịa.
  event_date     date,

  -- Sửa gân: kg/m trước–sau. Chênh lệch suy ra, không lưu (một nguồn một số).
  weight_before  numeric(12, 4),
  weight_after   numeric(12, 4),
  -- Tiền mở khuôn (opened) hoặc tiền sửa (modified).
  cost           numeric(14, 2),

  from_holder    text,                                   -- transferred
  to_holder      text,
  -- Mã thay thế: "TD-973 hư → DT-BD04 thay thế".
  related_die_id uuid references public.technical_dies(id) on delete set null,

  content        text,                                   -- nội dung sửa, nguyên văn
  -- Nguồn khi nạp từ file cũ ("F2/khuôn sửa a Thanh") — để tra ngược lúc số liệu
  -- bị nghi ngờ. Sự kiện người dùng tự ghi thì để trống.
  source         text,

  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists technical_die_events_die_idx
  on public.technical_die_events (die_id, event_date desc nulls last);
create index if not exists technical_die_events_type_idx
  on public.technical_die_events (event_type);

drop trigger if exists trg_technical_die_events_updated_at on public.technical_die_events;
create trigger trg_technical_die_events_updated_at
  before update on public.technical_die_events
  for each row execute function public.set_updated_at();

alter table public.technical_die_events enable row level security;

-- ── 4. Khuôn → mã vật tư nó ép ra ─────────────────────────────────────────
-- Hôm nay KHÔNG có gì nối khuôn với 533 mã vật tư nhôm (ĐVT: Cây 486 · Kg 37 ·
-- Tấm 10). Thiếu đường này thì biết kg/m cũng không biết ĐẶT MÃ NÀO.
--
-- Nhiều–nhiều: một khuôn ép ra nhiều mã (khác độ dày / hợp kim / bề mặt), và một
-- mã vật tư hiếm khi nhưng có thể ép được bằng hai khuôn ở hai nơi (22 cụm trùng).
--
-- Mồi được ngay 64/533 mã vì tên vật tư đã chứa mã khuôn:
--   NH-0126 "Nhôm oval TD-HG09" · NH-0167 "Nhôm tD-HG17 (10x50x 1li)"
-- Phần còn lại Kỹ thuật gắn dần khi chạm tới — đừng hứa 100% ngay.

create table if not exists public.technical_die_materials (
  id          uuid primary key default gen_random_uuid(),
  die_id      uuid not null references public.technical_dies(id) on delete cascade,
  material_id uuid not null references public.warehouse_materials(id) on delete cascade,
  -- Mã chính mà khuôn này ép ra — dùng khi hệ thống phải tự chọn một mã.
  is_primary  boolean not null default false,
  -- 'name_match' = script mồi theo tên, CHƯA ai xác nhận. 'manual' = người gắn.
  match_source text not null default 'manual'
                 check (match_source in ('manual', 'name_match')),
  note        text,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (die_id, material_id)
);

create index if not exists technical_die_materials_mat_idx
  on public.technical_die_materials (material_id);

alter table public.technical_die_materials enable row level security;

-- ── 5. Tệp đính vào hồ sơ khuôn ───────────────────────────────────────────
-- Theo đúng nếp `product_id` / `quote_id` đang có trên `files`: ảnh mặt cắt,
-- báo giá sửa khuôn, biên bản giao–nhận khuôn.

-- `on delete set null` theo đúng nếp `files.product_id` (0006): xoá hồ sơ không
-- xoá theo file trên Storage — file mồ côi còn tìm lại được, byte đã xoá thì không.
alter table public.files
  add column if not exists die_id uuid
    references public.technical_dies(id) on delete set null;

create index if not exists files_die_idx on public.files (die_id) where die_id is not null;
