-- LỆNH SẢN XUẤT 3 CẤP: lệnh → NHÓM → DÒNG (dựng lại từ 8 file LSX thật, 08/2026).
--
-- Vì sao phải đổi (chi tiết ở docs/lsx-redesign.md):
--   · Dòng lệnh KHÔNG phải dòng đơn hàng. File LAURA: mã 1700575.11 xuất hiện 5
--     lần, mỗi lần một số lượng và một ĐỢT XUẤT khác nhau. BR-02 cũ ("lệnh dùng
--     chung sales_order_lines, không nhân bản") không in nổi phiếu này → bãi bỏ.
--   · Cần một cấp NHÓM giữa lệnh và dòng: ROSCO nhóm theo SỐ PO (kèm khách con
--     "PAPAYA 138", ngày giao, tổng CBM), LAURA nhóm theo bộ sưu tập
--     ("ARIA (GIA CÔNG AN KHÁNH)"), YOTRIO ghi số đơn per dòng, MERXX không nhóm.
--     STT trên phiếu đánh lại từ 1 trong mỗi nhóm.
--   · Bộ cột đổi theo KHÁCH (MERXX có barcode + BOM/BẢNG VẼ/MẪU; ROSCO có
--     FINISH + CBM; YOTRIO có 8 ô swatches) → `sales_customers.lsx_template`
--     khai bộ cột, dòng lưu giá trị vào specs/checks/extras jsonb. Thêm khách
--     mới = khai mẫu, không đụng schema.
--
-- production_order_lines là NGUỒN DÒNG SẢN XUẤT mới: jobs (công đoạn) và
-- components (định hình) chuyển từ trỏ sales_order_lines sang trỏ nó. Dòng vẫn
-- giữ `sales_order_line_id` (nullable) để đối chiếu ngược SL đã lên lệnh vs SL
-- đơn — lệch thì CẢNH BÁO, không chặn (triết lý FR-PR-07).
--
-- `product_id` để NULL được: file thật có mã SP là "Thông báo sau",
-- "26300-309 ( có 1 mẫu màu bạc )" — mã là text tự do lúc phát lệnh.
--
-- Ngày xuất lưu ĐÔI: `ship_date` (date, để sắp lịch/cảnh báo trễ) +
-- `ship_label` (đúng chữ Sales gõ: "w37.26", "DỰ KIẾN kiểm hàng 5/10/2026").
--
-- REVISION: Sales sửa lệnh rồi phát lại (diff LAURA gốc ↔ REVISED = 69 dòng
-- đổi mà xưởng không biết dòng nào). `production_orders.revision` +
-- `production_order_lines.changed_in_rev` để phiếu in đánh dấu dòng vừa đổi.
--
-- DỮ LIỆU: mọi bảng bị đụng đang RỖNG trên DB thật (jobs/components/entries/
-- line_specs = 0 dòng) nên đổi cột thẳng, không cần backfill.
-- `production_order_line_specs` (0014) bị THAY bởi `production_order_lines.specs`
-- → drop hẳn.
--
-- RLS: bảng mới ENABLE, KHÔNG policy (anon bị chặn, secret key bypass) — như
-- mọi bảng khác. Idempotent: create if not exists / add column if not exists /
-- drop ... if exists.

-- ── 1. Mẫu cột phiếu LSX theo khách ─────────────────────────────────────────
alter table public.sales_customers
  add column if not exists lsx_template jsonb not null default '{}'::jsonb;

comment on column public.sales_customers.lsx_template is
  'Mẫu cột phiếu LSX của khách (0114): {preset, spec_columns[], extra_columns[], check_columns[], show_cbm, notes_footer}. {} = dùng preset mặc định.';

-- ── 2. Phiên bản lệnh ───────────────────────────────────────────────────────
alter table public.production_orders
  add column if not exists revision      integer not null default 1,
  add column if not exists revised_at    timestamptz,
  add column if not exists revised_by    uuid references public.users(id) on delete set null,
  add column if not exists revision_note text;

comment on column public.production_orders.revision is
  'Số lần phát lại lệnh (0114). Bản in bản >1 mang tiêu đề "CHỈNH SỬA NGÀY …" và đánh dấu dòng đổi.';

-- ── 3. Nhóm dòng ────────────────────────────────────────────────────────────
create table if not exists public.production_order_groups (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  -- Nhóm = 1 đơn hàng (ROSCO/YOTRIO) hoặc nhóm tự đặt tên (LAURA) → nullable.
  sales_order_id      uuid references public.sales_orders(id) on delete set null,
  title               text,          -- 'HALI - HALSTON - AMELIA', 'ARIA (GIA CÔNG AN KHÁNH)'
  buyer_name          text,          -- khách con trên phiếu ROSCO: 'PAPAYA 138'
  po_no               text,          -- SỐ PO: 'PT-138-155-HG'
  ship_date           date,
  ship_label          text,
  note                text,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists production_order_groups_lsx_idx
  on public.production_order_groups (production_order_id, sort_order);

drop trigger if exists trg_production_order_groups_updated_at on public.production_order_groups;
create trigger trg_production_order_groups_updated_at
  before update on public.production_order_groups
  for each row execute function public.set_updated_at();

alter table public.production_order_groups enable row level security;

-- ── 4. Dòng lệnh ────────────────────────────────────────────────────────────
create table if not exists public.production_order_lines (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  group_id            uuid not null
                        references public.production_order_groups(id) on delete cascade,
  -- Liên kết MỀM: SP có thể chưa có trong danh mục lúc phát lệnh.
  product_id          uuid references public.technical_products(id) on delete set null,
  -- Đối chiếu ngược về dòng đơn (một dòng đơn đẻ ra nhiều dòng lệnh theo đợt xuất).
  sales_order_line_id uuid references public.sales_order_lines(id) on delete set null,
  product_code        text not null default '',   -- cho phép 'Thông báo sau'
  name_foreign        text,                       -- tên Anh/Đức (in trên shipping mark)
  name_vi             text,
  name_customs        text,                       -- 'Tên khai hải quan (kế toán)' — LAURA
  barcode             text,
  unit                text not null default '',
  qty                 numeric(14, 2) not null default 0,
  packing             text,                       -- '4 cái/ thùng', '1 bộ/ 2 thùng'
  cbm                 numeric(12, 4),             -- CBM/SP — ROSCO tính đầy container
  ship_date           date,
  ship_label          text,                       -- 'w37.26', 'DỰ KIẾN kiểm hàng 5/10'
  specs               jsonb not null default '{}'::jsonb,  -- theo spec_columns của khách
  checks              jsonb not null default '{}'::jsonb,  -- BOM/BẢNG VẼ/MẪU… (text, không boolean)
  extras              jsonb not null default '{}'::jsonb,  -- cột phụ theo mẫu (carton size, FINISH…)
  note                text,
  important_note      text,                       -- cột 'Lưu ý quan trọng' — LAURA
  image_file_id       uuid references public.files(id) on delete set null,
  sort_order          integer not null default 0,
  -- Revision phát hiện dòng vừa đổi → bản in tô vàng + dấu ▲.
  changed_in_rev      integer,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists production_order_lines_lsx_idx
  on public.production_order_lines (production_order_id, sort_order);
create index if not exists production_order_lines_group_idx
  on public.production_order_lines (group_id, sort_order);
create index if not exists production_order_lines_order_line_idx
  on public.production_order_lines (sales_order_line_id);

drop trigger if exists trg_production_order_lines_updated_at on public.production_order_lines;
create trigger trg_production_order_lines_updated_at
  before update on public.production_order_lines
  for each row execute function public.set_updated_at();

alter table public.production_order_lines enable row level security;

-- ── 5. Trục sản xuất trỏ sang dòng lệnh ─────────────────────────────────────
-- KHÔNG drop cột cũ: chỉ THÊM `production_order_line_id` và nới `order_line_id`
-- thành nullable. Cả hai bảng đang rỗng nên không mất gì, mà migration giữ được
-- tính chất "chỉ thêm" — dọn cột/bảng cũ để một migration riêng làm sau khi bản
-- mới chạy ổn ở xưởng (xem cuối file).
alter table public.production_jobs
  alter column order_line_id drop not null;
alter table public.production_jobs
  add column if not exists production_order_line_id uuid
    references public.production_order_lines(id) on delete cascade;

create index if not exists production_jobs_line_idx
  on public.production_jobs (production_order_line_id, seq);

-- Unique cũ (lsx, order_line, stage) không còn hiệu lực khi order_line_id NULL;
-- ràng buộc thật nay là (dòng lệnh, công đoạn) — dòng lệnh đã thuộc đúng 1 lệnh.
alter table public.production_jobs
  drop constraint if exists production_jobs_line_stage_key;
alter table public.production_jobs
  add constraint production_jobs_line_stage_key
    unique (production_order_line_id, stage);

alter table public.production_components
  alter column order_line_id drop not null;
alter table public.production_components
  add column if not exists production_order_line_id uuid
    references public.production_order_lines(id) on delete cascade;

create index if not exists production_components_line_idx_v2
  on public.production_components (production_order_line_id);

comment on column public.production_jobs.order_line_id is
  'BỎ DÙNG từ 0114 — dùng production_order_line_id. Giữ lại để dọn ở migration riêng.';
comment on column public.production_components.order_line_id is
  'BỎ DÙNG từ 0114 — dùng production_order_line_id. Giữ lại để dọn ở migration riêng.';

-- CÒN NỢ (migration dọn dẹp riêng, chạy sau khi bản mới chạy ổn):
--   alter table production_jobs        drop column order_line_id;
--   alter table production_components  drop column order_line_id;
--   drop table production_order_line_specs;   -- thay bởi production_order_lines.specs
-- Ba câu này XOÁ DỮ LIỆU/CỘT nên tách ra để chủ dự án bấm khi sẵn sàng.
