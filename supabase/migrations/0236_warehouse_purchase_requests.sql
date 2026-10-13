-- 0236 — ĐỀ NGHỊ MUA VẬT TƯ (13/10/2026, bản vẽ https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g)
--
-- Số hoá tờ "GIẤY ĐỀ NGHỊ MUA VẬT TƯ" Kho vật tư đang viết tay rồi chụp gửi Zalo
-- cho lãnh đạo ("Ok" trong chat là duyệt). Đo 13/10: 0 chứng từ đề nghị trên hệ
-- thống; sau chữ "Ok" không còn vết nào nối đề nghị → đơn mua → hàng về.
--
--   warehouse_purchase_requests       — một phiếu: mã DNM-YYYY-NNNN
--                                       (next_doc_code('DNM')), bộ phận, người
--                                       đề nghị, cần trước ngày, ghi chú chung,
--                                       lệnh SX tuỳ chọn, vòng đời.
--   warehouse_purchase_request_lines  — dòng: mã vật tư TUỲ CHỌN (thứ chưa có mã
--                                       gõ tên tự do — Q3), SL, đơn giá dự kiến
--                                       tuỳ chọn (Q4), mục đích / tổ dùng (Q5).
--
-- Vòng đời (bản vẽ DN-0): draft → pending (gửi duyệt) → approved → ordering (đã
-- có đơn mua) → done. Từ chối = về draft + ghi lý do vào rejected_* (giữ lần từ
-- chối gần nhất). Huỷ = cancelled, không xoá. Bước này (Đ1) chỉ dùng draft /
-- pending / cancelled; approved_qty, po_line_id để sẵn cho Đ2 (duyệt, sửa số) và
-- Đ3 (Cung ứng lập đơn từ phiếu) — cột trống không hại gì, đỡ một migration.
--
-- RLS: bật, KHÔNG policy — anon (publishable key) bị chặn, khoá bí mật của server
-- đi qua. Mọi truy cập qua route + service (quyền ở rbac/actions). Idempotent.

create table if not exists public.warehouse_purchase_requests (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  status              text not null default 'draft'
                        check (status in ('draft', 'pending', 'approved', 'ordering', 'done', 'cancelled')),
  department          text not null default 'Kho vật tư'
                        check (char_length(btrim(department)) between 2 and 120),
  requested_by        uuid references public.users(id) on delete set null,
  need_by             date,
  note                text check (note is null or char_length(note) <= 2000),
  production_order_id uuid references public.production_orders(id) on delete set null,
  submitted_at        timestamptz,
  submitted_by        uuid references public.users(id) on delete set null,
  approved_at         timestamptz,
  approved_by         uuid references public.users(id) on delete set null,
  rejected_at         timestamptz,
  rejected_by         uuid references public.users(id) on delete set null,
  rejected_reason     text check (rejected_reason is null or char_length(rejected_reason) <= 1000),
  cancelled_at        timestamptz,
  cancelled_by        uuid references public.users(id) on delete set null,
  cancel_reason       text check (cancel_reason is null or char_length(cancel_reason) <= 1000),
  created_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists warehouse_purchase_requests_status_idx
  on public.warehouse_purchase_requests (status, created_at desc);

drop trigger if exists warehouse_purchase_requests_set_updated_at on public.warehouse_purchase_requests;
create trigger warehouse_purchase_requests_set_updated_at
  before update on public.warehouse_purchase_requests
  for each row execute function public.set_updated_at();

alter table public.warehouse_purchase_requests enable row level security;

create table if not exists public.warehouse_purchase_request_lines (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.warehouse_purchase_requests(id) on delete cascade,
  line_no      int not null check (line_no >= 1),
  -- Null = thứ chưa có mã trong danh mục (gõ tên tự do, Q3). Mã bị xoá khỏi
  -- danh mục thì dòng vẫn giữ tên + ĐVT đã chép.
  material_id  uuid references public.warehouse_materials(id) on delete set null,
  name         text not null check (char_length(btrim(name)) between 1 and 300),
  unit         text not null check (char_length(btrim(unit)) between 1 and 40),
  qty          numeric(18, 4) not null check (qty > 0),
  -- Đ2: lãnh đạo sửa số trước khi duyệt. Null = duyệt đúng số đề nghị.
  approved_qty numeric(18, 4) check (approved_qty is null or approved_qty >= 0),
  -- Dự kiến, VND, chưa VAT (Q4) — để lãnh đạo thấy cỡ tiền, không ràng buộc đơn mua.
  unit_price   numeric(18, 2) check (unit_price is null or unit_price >= 0),
  purpose      text check (purpose is null or char_length(purpose) <= 200),
  note         text check (note is null or char_length(note) <= 500),
  -- Đ3: dòng đơn mua lập từ dòng này.
  po_line_id   uuid references public.supply_purchase_order_lines(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (request_id, line_no)
);

create index if not exists warehouse_purchase_request_lines_material_idx
  on public.warehouse_purchase_request_lines (material_id) where material_id is not null;
create index if not exists warehouse_purchase_request_lines_po_line_idx
  on public.warehouse_purchase_request_lines (po_line_id) where po_line_id is not null;

drop trigger if exists warehouse_purchase_request_lines_set_updated_at on public.warehouse_purchase_request_lines;
create trigger warehouse_purchase_request_lines_set_updated_at
  before update on public.warehouse_purchase_request_lines
  for each row execute function public.set_updated_at();

alter table public.warehouse_purchase_request_lines enable row level security;

-- Khuôn mã + tiêu đề phiếu in (theo đúng tờ giấy đang dùng: quốc hiệu, hai ô ký).
insert into public.doc_templates
  (kind, label, prefix, pattern, seq_pad, reset_scope, title_vi, title_en,
   national_heading, form_no, signatures, default_terms)
values
  ('DNM', 'Đề nghị mua vật tư', 'DNM', '{prefix}-{yyyy}-{seq}', 4, 'year',
   'GIẤY ĐỀ NGHỊ MUA VẬT TƯ', 'PURCHASE REQUISITION', true, null,
   '[{"role":"Duyệt của lãnh đạo","hint":"Ký, ghi rõ họ tên","slot":"approver"},
     {"role":"Người đề nghị","hint":"Ký, ghi rõ họ tên","slot":"creator"}]'::jsonb, '')
on conflict (kind) do nothing;

comment on table public.warehouse_purchase_requests is
  'Đề nghị mua vật tư của Kho (0236) — Kho lập, lãnh đạo duyệt, Cung ứng lập đơn mua. Mã DNM-YYYY-NNNN.';
comment on table public.warehouse_purchase_request_lines is
  'Dòng đề nghị mua (0236). material_id null = chưa có mã, gõ tên tự do.';
